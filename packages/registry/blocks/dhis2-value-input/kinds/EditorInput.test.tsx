import { CustomDataProvider } from '@dhis2/app-runtime'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { birthFromAge, todayIso } from '@/components/dhis2-value-types'
import type { Field, ValueSettings } from '@/components/dhis2-value-types'
import { formEditors } from '../editors/popupEditors'
import { ValueInput } from '../ValueInput'
import type { ValueInputProps } from '../ValueInput'

const SETTINGS: ValueSettings = {
    calendar: 'gregorian',
    dateFormat: 'YYYY-MM-DD',
}
const LABEL = 'Notes'

/** A server that keeps each upload waiting until the test lets it answer or fail, and the signal it was sent with. */
const server = () => {
    const uploads: Array<{
        signal?: AbortSignal
        release(): void
        fail(): void
    }> = []
    const Server = ({ children }: { children: ReactNode }) => (
        <CustomDataProvider
            data={{
                fileResources: (_type, _request, execute) =>
                    new Promise((resolve, reject) => {
                        const id = `File${uploads.length + 1}`
                        uploads.push({
                            signal: execute?.signal,
                            fail: () => reject(new Error('Disk full')),
                            release: () =>
                                resolve({
                                    status: 'OK',
                                    response: {
                                        fileResource: { id, name: `${id}.txt` },
                                    },
                                }),
                        })
                    }),
            }}
        >
            {children}
        </CustomDataProvider>
    )
    return { uploads, Server }
}

/**
 * A field in a form that keeps the value it is told, with a button after it to leave the field for. `submits` has, for
 * each time the form submitted, how many changes were reported by then. `assign` sets a value as a rule would, and
 * `update` gives the field other props, such as another field, settings or a lock.
 */
const mount = async (field: Field, props: Partial<ValueInputProps> = {}) => {
    const onChange = vi.fn()
    const submits: number[] = []
    const { uploads, Server } = server()
    const Host = ({
        shown,
        assigned,
        storedFile = props.storedFile,
        over,
    }: {
        shown: boolean
        assigned?: { value: string }
        storedFile?: ValueInputProps['storedFile']
        over?: Partial<ValueInputProps>
    }) => {
        const [value, setValue] = useState(props.value)
        useEffect(() => {
            if (assigned !== undefined) {
                setValue(assigned.value)
            }
        }, [assigned])
        return (
            <Server>
                <form
                    onSubmit={(event) => {
                        event.preventDefault()
                        submits.push(onChange.mock.calls.length)
                    }}
                >
                    {shown ? (
                        <ValueInput
                            field={field}
                            settings={SETTINGS}
                            label={LABEL}
                            {...props}
                            {...over}
                            storedFile={storedFile}
                            // A value given with `over` comes in the same render as the rest of it.
                            value={over && 'value' in over ? over.value : value}
                            onChange={(next, problem) => {
                                onChange(next, problem)
                                setValue(next ?? undefined)
                            }}
                        />
                    ) : null}
                    <button type="button">After</button>
                    <button type="submit">Submit</button>
                </form>
            </Server>
        )
    }
    const screen = await render(<Host shown />)
    return {
        onChange,
        uploads,
        submits,
        leave: () => page.getByRole('button', { name: 'After' }).click(),
        unmount: () => screen.rerender(<Host shown={false} />),
        assign: (value: string) =>
            screen.rerender(<Host shown assigned={{ value }} />),
        link: (storedFile: ValueInputProps['storedFile']) =>
            screen.rerender(<Host shown storedFile={storedFile} />),
        update: (over: Partial<ValueInputProps>) =>
            screen.rerender(<Host shown over={over} />),
    }
}

const choose = (name: string) => {
    const picker = document.querySelector('input[type="file"]')
    if (picker === null) {
        throw new Error('The field has no file input')
    }
    return userEvent.upload(
        picker,
        new File(['x'], name, { type: 'text/plain' })
    )
}

const later = (ms: number) =>
    new Promise((resolve) => {
        setTimeout(resolve, ms)
    })

test('long text is reported once, when the field is left; Enter adds a line', async () => {
    const { onChange, leave } = await mount({ valueType: 'LONG_TEXT' })
    const text = page.getByRole('textbox', { name: LABEL })
    // In a form the field waits to be focused, and has no buttons of its own.
    await expect.element(text).not.toHaveFocus()
    expect(page.getByRole('button', { name: 'Save' }).elements()).toEqual([])
    expect(page.getByRole('button', { name: 'Cancel' }).elements()).toEqual([])

    await userEvent.click(text)
    await userEvent.keyboard('Seen{Enter}at home')
    await expect.element(text).toHaveValue('Seen\nat home')
    expect(onChange).not.toHaveBeenCalled()

    await leave()
    expect(onChange.mock.calls).toEqual([['Seen\nat home', undefined]])
})

test('an age typed in years is reported as the date of birth when the field is left', async () => {
    const { onChange, leave } = await mount({ valueType: 'AGE' })
    expect(page.getByRole('button', { name: 'Save' }).elements()).toEqual([])
    expect(page.getByRole('button', { name: 'Cancel' }).elements()).toEqual([])

    await userEvent.fill(page.getByRole('textbox', { name: 'Years' }), '30')
    // Moving between the age's own fields is not leaving it.
    await userEvent.click(page.getByRole('textbox', { name: 'Months' }))
    expect(onChange).not.toHaveBeenCalled()

    await leave()
    expect(onChange.mock.calls).toEqual([
        [
            birthFromAge({ years: 30, months: 0, days: 0 }, todayIso()),
            undefined,
        ],
    ])
})

test('a coordinate out of range is reported as a problem when the field is left, and shown', async () => {
    const { onChange, leave } = await mount({ valueType: 'COORDINATE' })
    const latitude = page.getByRole('textbox', { name: 'Latitude' })
    await userEvent.fill(latitude, '95')
    await userEvent.fill(page.getByRole('textbox', { name: 'Longitude' }), '10')
    expect(onChange).not.toHaveBeenCalled()

    await leave()
    const problem = {
        message: 'Enter a latitude between -90 and 90',
        text: '95, 10',
    }
    expect(onChange.mock.calls).toEqual([[null, problem]])
    await expect
        .element(page.getByRole('alert'))
        .toHaveTextContent(problem.message)

    // Fixed, the problem goes, and the value is reported on leaving.
    await userEvent.fill(latitude, '8')
    await expect.element(page.getByRole('alert')).not.toBeInTheDocument()
    await leave()
    expect(onChange.mock.calls.at(-1)).toEqual(['[10,8]', undefined])
})

test('a multi-select is reported when the field is left, in option-set order', async () => {
    const { onChange, leave } = await mount({
        valueType: 'MULTI_TEXT',
        options: [
            { code: 'FEVER', name: 'Fever' },
            { code: 'COUGH', name: 'Cough' },
        ],
    })
    await userEvent.click(page.getByRole('checkbox', { name: 'Cough' }))
    await userEvent.click(page.getByRole('checkbox', { name: 'Fever' }))
    expect(onChange).not.toHaveBeenCalled()

    await leave()
    expect(onChange.mock.calls).toEqual([['FEVER,COUGH', undefined]])
})
test('a chosen file is reported as still uploading at once, then as its id', async () => {
    const { onChange, uploads } = await mount({ valueType: 'FILE_RESOURCE' })
    const scan = new File(['x'], 'scan.txt', { type: 'text/plain' })
    const picker = document.querySelector('input[type="file"]')
    if (picker === null) {
        throw new Error('The field has no file input')
    }
    await userEvent.upload(picker, scan)
    await expect.poll(() => uploads).toHaveLength(1)
    expect(onChange.mock.calls).toEqual([
        [null, { message: 'Still uploading', text: 'scan.txt' }],
    ])

    uploads[0].release()
    await expect.poll(() => onChange.mock.calls).toHaveLength(2)
    expect(onChange.mock.calls[1]).toEqual(['File1', undefined])
    // The field keeps the name of the file it chose.
    await expect.element(page.getByText('scan.txt')).toBeVisible()
})

test('a field that leaves the page mid-upload stops the upload and reports what it held', async () => {
    const { onChange, uploads, unmount } = await mount({
        valueType: 'FILE_RESOURCE',
    })
    const picker = document.querySelector('input[type="file"]')
    if (picker === null) {
        throw new Error('The field has no file input')
    }
    await userEvent.upload(
        picker,
        new File(['x'], 'scan.txt', { type: 'text/plain' })
    )
    await expect.poll(() => uploads).toHaveLength(1)
    expect(onChange).toHaveBeenCalledTimes(1)

    await unmount()
    expect(uploads[0].signal?.aborted).toBe(true)
    // No file came of it: the host gets back what the field held, without the upload's problem.
    expect(onChange.mock.calls[1]).toEqual([null, undefined])
    uploads[0].release()
    await later(50)
    expect(onChange).toHaveBeenCalledTimes(2)
})

test('Enter in an age field reports it before a surrounding form submits, while focus stays', async () => {
    const { onChange, submits } = await mount({ valueType: 'AGE' })
    const years = page.getByRole('textbox', { name: 'Years' })
    await userEvent.fill(years, '30')
    await userEvent.keyboard('{Enter}')
    expect(onChange.mock.calls).toEqual([
        [
            birthFromAge({ years: 30, months: 0, days: 0 }, todayIso()),
            undefined,
        ],
    ])
    expect(submits).toEqual([1])
    await expect.element(years).toHaveFocus()
})

test('a required pop-up field says so in its name', async () => {
    await mount({ valueType: 'COORDINATE' }, { required: true })
    await expect
        .element(page.getByRole('group', { name: `${LABEL} required` }))
        .toBeVisible()
})

test("a coordinate's fields are marked invalid and described by the problem once it is reported", async () => {
    const { leave } = await mount({ valueType: 'COORDINATE' })
    const latitude = page.getByRole('textbox', { name: 'Latitude' })
    const longitude = page.getByRole('textbox', { name: 'Longitude' })
    await expect.element(latitude).not.toHaveAttribute('aria-invalid')

    await userEvent.fill(latitude, '95')
    await leave()
    for (const each of [latitude, longitude]) {
        await expect.element(each).toHaveAttribute('aria-invalid', 'true')
        await expect
            .element(each)
            .toHaveAccessibleDescription('Enter a latitude between -90 and 90')
    }
    await expect
        .element(page.getByRole('group', { name: LABEL }))
        .not.toHaveAttribute('aria-invalid')
})

test("an age's fields are marked invalid by an error message from the host", async () => {
    await mount(
        { valueType: 'AGE' },
        { messages: [{ tone: 'error', text: 'Too young for this stage' }] }
    )
    const years = page.getByRole('textbox', { name: 'Years' })
    await expect.element(years).toHaveAttribute('aria-invalid', 'true')
    await expect
        .element(years)
        .toHaveAccessibleDescription('Error: Too young for this stage')
})

test("long text is described by the field's description and messages, and marked invalid by an error", async () => {
    await mount(
        { valueType: 'LONG_TEXT' },
        {
            description: 'What the nurse saw',
            messages: [
                { tone: 'warning', text: 'Ask about travel' },
                { tone: 'error', text: 'Say where' },
            ],
        }
    )
    const text = page.getByRole('textbox', { name: LABEL })
    await expect
        .element(text)
        .toHaveAccessibleDescription(
            'What the nurse saw Warning: Ask about travel Error: Say where'
        )
    await expect.element(text).toHaveAttribute('aria-invalid', 'true')
})

test('a rule that assigns again what was typed before its own value shows it', async () => {
    const { onChange, leave, assign } = await mount({ valueType: 'LONG_TEXT' })
    const text = page.getByRole('textbox', { name: LABEL })
    await userEvent.fill(text, 'Mine')
    await leave()
    expect(onChange.mock.calls).toEqual([['Mine', undefined]])

    await assign('Rule')
    await expect.element(text).toHaveValue('Rule')
    await assign('Mine')
    await expect.element(text).toHaveValue('Mine')
})

test('a value a rule assigns during an upload stops the upload, which then reports nothing', async () => {
    const { onChange, uploads, assign } = await mount({
        valueType: 'FILE_RESOURCE',
    })
    await choose('scan.txt')
    await expect.poll(() => uploads).toHaveLength(1)
    expect(onChange).toHaveBeenCalledTimes(1)

    await assign('Assigned')
    await expect.poll(() => uploads[0].signal?.aborted).toBe(true)
    uploads[0].release()
    await later(50)
    expect(onChange).toHaveBeenCalledTimes(1)
})

test('an upload that fails reports the file the field held before, and says why', async () => {
    const { onChange, uploads } = await mount(
        { valueType: 'FILE_RESOURCE' },
        { value: 'Old', valueName: 'old.pdf' }
    )
    await choose('scan.txt')
    await expect.poll(() => uploads).toHaveLength(1)
    uploads[0].fail()
    await expect.poll(() => onChange.mock.calls).toHaveLength(2)
    expect(onChange.mock.calls).toEqual([
        [null, { message: 'Still uploading', text: 'scan.txt' }],
        ['Old', undefined],
    ])
    await expect
        .element(page.getByText('Could not upload the file. Try again.'))
        .toBeVisible()
    await expect.element(page.getByText('old.pdf')).toBeVisible()
})

// A 1x1 GIF the browser draws, as raw bytes: an image decoder ignores the `?dimension=MEDIUM` added after its end.
const STORED_IMAGE = `data:image/gif,${[
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
    0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0x21, 0xf9, 0x04, 0x01, 0x00,
    0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
    0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
]
    .map((byte) => `%${byte.toString(16).padStart(2, '0')}`)
    .join('')}`

test('an image the host links stops showing once removed, and an upload in its place shows no link to it', async () => {
    const { uploads } = await mount(
        { valueType: 'IMAGE' },
        {
            value: 'Old',
            valueName: 'old.png',
            storedFile: { value: 'Old', url: STORED_IMAGE },
        }
    )
    await expect
        .element(page.getByRole('img', { name: 'old.png' }))
        .toBeVisible()

    await userEvent.click(page.getByRole('button', { name: 'Remove' }))
    // Not by role: an image with no name left is no `img` to a screen reader, and still shows.
    await expect.poll(() => document.querySelector('img')).toBeNull()

    const picker = document.querySelector('input[type="file"]')
    if (picker === null) {
        throw new Error('The field has no file input')
    }
    await userEvent.upload(
        picker,
        new File(['x'], 'scan.png', { type: 'image/png' })
    )
    await expect.poll(() => uploads).toHaveLength(1)
    uploads[0].release()
    await expect.element(page.getByText('scan.png')).toBeVisible()
    expect(document.querySelector('img')).toBeNull()
    await expect
        .element(page.getByRole('link', { name: 'Download' }))
        .not.toBeInTheDocument()
})

test('an image uploaded here shows once the host links the file it saved', async () => {
    const { uploads, link } = await mount(
        { valueType: 'IMAGE' },
        {
            value: 'Old',
            valueName: 'old.png',
            storedFile: { value: 'Old', url: STORED_IMAGE },
        }
    )
    const picker = document.querySelector('input[type="file"]')
    if (picker === null) {
        throw new Error('The field has no file input')
    }
    await userEvent.upload(
        picker,
        new File(['x'], 'scan.png', { type: 'image/png' })
    )
    await expect.poll(() => uploads).toHaveLength(1)
    uploads[0].release()
    await expect.element(page.getByText('scan.png')).toBeVisible()
    expect(document.querySelector('img')).toBeNull()

    // The host saved the upload and links it at the same address, as DHIS2 serves an event's file.
    await link({ value: 'File1', url: STORED_IMAGE })
    await expect
        .element(page.getByRole('img', { name: 'scan.png' }))
        .toBeVisible()
})

test('a read-only image the host links shows a preview and "Download", and says why', async () => {
    await mount(
        { valueType: 'IMAGE' },
        {
            value: 'File1',
            valueName: 'scan.png',
            storedFile: { value: 'File1', url: STORED_IMAGE },
            readOnly: 'Assigned by a rule',
        }
    )
    const name = page.getByRole('textbox', { name: LABEL })
    await expect.element(name).toHaveValue('scan.png')
    await expect.element(name).toHaveAccessibleDescription('Assigned by a rule')
    await expect
        .element(page.getByRole('img', { name: 'scan.png' }))
        .toBeVisible()
    await expect
        .element(page.getByRole('link', { name: 'Download' }))
        .toHaveAttribute('href', STORED_IMAGE)
})

test.each([
    ['A file', 'FILE_RESOURCE', true],
    ['An image', 'IMAGE', true],
    ['A long text', 'LONG_TEXT', false],
] as const)(
    "%s field's editor is given uploads only when it takes files",
    async (_, type, given) => {
        const editor = formEditors[type]
        const uploadsGiven = vi.fn()
        formEditors[type] = ({ uploads }) => {
            uploadsGiven(uploads !== undefined)
            return null
        }
        onTestFinished(() => {
            formEditors[type] = editor
        })
        await mount({ valueType: type })
        expect(uploadsGiven).toHaveBeenLastCalledWith(given)
    }
)

test('after a coordinate problem, the host saying back the report keeps it; another value replaces the editor and drops it', async () => {
    const { onChange, leave, assign } = await mount(
        { valueType: 'COORDINATE' },
        { value: '[10,8]' }
    )
    const latitude = page.getByRole('textbox', { name: 'Latitude' })
    const longitude = page.getByRole('textbox', { name: 'Longitude' })
    await userEvent.fill(latitude, '95')
    await leave()
    expect(onChange.mock.calls).toEqual([
        [
            null,
            { message: 'Enter a latitude between -90 and 90', text: '95, 10' },
        ],
    ])
    // The host stored the cleared value the problem reported.
    await expect.element(latitude).toHaveValue('95')
    await expect
        .element(page.getByText('Enter a latitude between -90 and 90'))
        .toBeVisible()

    await assign('[20,5]')
    await expect.element(latitude).toHaveValue('5')
    await expect.element(longitude).toHaveValue('20')
    await expect
        .element(page.getByText('Enter a latitude between -90 and 90'))
        .not.toBeInTheDocument()
    await expect.element(latitude).not.toHaveAttribute('aria-invalid')
})

test('a rule that assigns a file and locks the field mid-upload keeps its file: the upload reports nothing', async () => {
    const { onChange, uploads, update } = await mount(
        { valueType: 'FILE_RESOURCE' },
        { value: 'oldFileId1' }
    )
    await choose('scan.txt')
    await expect.poll(() => uploads).toHaveLength(1)
    expect(onChange).toHaveBeenCalledTimes(1)

    await update({ value: 'ruleFileId', readOnly: 'Assigned by a rule' })
    await expect.poll(() => uploads[0].signal?.aborted).toBe(true)
    uploads[0].release()
    await later(50)
    expect(onChange).toHaveBeenCalledTimes(1)
})

test('a file field that becomes another field mid-upload stops the upload, which then reports nothing', async () => {
    const { onChange, uploads, update } = await mount({
        valueType: 'FILE_RESOURCE',
    })
    await choose('scan.txt')
    await expect.poll(() => uploads).toHaveLength(1)
    expect(onChange).toHaveBeenCalledTimes(1)

    await update({ field: { valueType: 'AGE' } })
    await expect.poll(() => uploads[0].signal?.aborted).toBe(true)
    uploads[0].release()
    await later(50)
    expect(onChange).toHaveBeenCalledTimes(1)
})

test('an age given another date format shows its date of birth in that format', async () => {
    const { update } = await mount(
        { valueType: 'AGE' },
        { value: '1990-01-02' }
    )
    const birth = page.getByRole('textbox', { name: 'Date of birth' })
    await expect.element(birth).toHaveValue('1990-01-02')

    await update({
        settings: { calendar: 'gregorian', dateFormat: 'DD-MM-YYYY' },
    })
    await expect.element(birth).toHaveValue('02-01-1990')
})

test('a coordinate problem goes once a rule locks the field, and stays gone when it unlocks', async () => {
    const { leave, update } = await mount({ valueType: 'COORDINATE' })
    await userEvent.fill(page.getByRole('textbox', { name: 'Latitude' }), '95')
    await userEvent.fill(page.getByRole('textbox', { name: 'Longitude' }), '10')
    await leave()
    await expect
        .element(page.getByText('Enter a latitude between -90 and 90'))
        .toBeVisible()

    await update({ readOnly: 'Assigned by a rule' })
    await update({})
    const latitude = page.getByRole('textbox', { name: 'Latitude' })
    await expect.element(latitude).toHaveValue('')
    await expect
        .element(page.getByText('Enter a latitude between -90 and 90'))
        .not.toBeInTheDocument()
    await expect.element(latitude).not.toHaveAttribute('aria-invalid')
})
