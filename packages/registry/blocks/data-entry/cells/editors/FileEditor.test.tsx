/// <reference types="@vitest/browser-playwright" />
import { FetchError } from '@dhis2/app-runtime'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import type { Field } from '@/components/dhis2-value-types'
import { control } from '../../grid/__tests__/gridRig'
import { cellKey } from '../../model/types'
import type { GridColumn } from '../../model/types'
import {
    cleanUp,
    memorySource,
    mount as mountForm,
    visitForm,
} from '../../provider/__tests__/rig'
import refused from '../../sources/__tests__/fixtures/file-upload-refused.json'
import uploaded from '../../sources/__tests__/fixtures/file-upload.json'
import { CELL, HEADER, inputOf, rig } from '../__tests__/harness'
import type { ServerRequest } from '../__tests__/harness'
import { Cell } from '../Cell'

afterEach(cleanUp)

const FILE: Field = { valueType: 'FILE_RESOURCE' }
const IMAGE: Field = { valueType: 'IMAGE' }
// A file DHIS2 holds for the event, with the name the form loaded for it, and one uploaded for it.
const STORED = 'Yqp5K9rz3I2'
const STORED_NAME = 'doc.pdf'
const NAMES = new Map([[STORED, STORED_NAME]])
const UPLOADED = uploaded.response.fileResource.id
const NAME = uploaded.response.fileResource.name
// Another upload, chosen after the first.
const LATER = 'LaTeRfIlE01'
const LATER_NAME = 'later.txt'
const uploadedLater = {
    ...uploaded,
    response: {
        ...uploaded.response,
        fileResource: {
            ...uploaded.response.fileResource,
            id: LATER,
            name: LATER_NAME,
        },
    },
}
const OFFLINE = 'Connect to the internet to upload files'
const LOCKED = 'Assigned by rule: Copy the scan'
// The harness's cell is row r1 (an event), column c1 (a data element); the base URL is the platform's default.
const EVENT_FILE = '../api/tracker/events/r1/dataValues/c1/file'
const EVENT_IMAGE = '../api/tracker/events/r1/dataValues/c1/image'

type Answer = () => Promise<{ status: string }>

interface Upload {
    request: ServerRequest
    signal?: AbortSignal
}

/**
 * A file or image cell over a fake server, with the names the form loaded for its files: the server answers each
 * upload with `answer` (the uploaded file unless a test says otherwise) and keeps any read, which no test expects.
 */
const mount = async (field: Field, options: Parameters<typeof rig>[1] = {}) => {
    const uploads: Upload[] = []
    const reads: ServerRequest[] = []
    let answer: Answer = async () => uploaded
    const setup = rig(field, {
        fileNames: NAMES,
        ...options,
        data: {
            fileResources: async (type, request, execute) => {
                if (type === 'read') {
                    reads.push(request)
                    return { name: 'Asked for' }
                }
                uploads.push({ request, signal: execute?.signal })
                return answer()
            },
        },
    })
    const cell = (
        <Cell
            cellKey={CELL}
            field={field}
            labelledBy={HEADER}
            move={setup.move}
        />
    )
    const screen = await render(setup.ui(cell))
    return {
        ...setup,
        uploads,
        reads,
        screen,
        cell: page.getByRole('textbox', { name: 'Age (years)' }),
        answerWith(next: Answer) {
            answer = next
        },
        /** Keeps the next upload waiting; returns what lets it finish with `answered`. */
        hold(answered: { status: string } = uploaded) {
            let release = () => {}
            answer = () =>
                new Promise((resolve) => {
                    release = () => resolve(answered)
                })
            return () => release()
        },
        /** Takes the cell off the page, as a row the grid drops. */
        async drop() {
            await screen.rerender(setup.ui(null))
        },
    }
}

const dialog = page.getByRole('dialog', { name: 'Edit Age (years)' })
const button = (name: string) => dialog.getByRole('button', { name })
const chosen = new File(['x'], NAME, { type: 'text/plain' })
const chosenLater = new File(['y'], LATER_NAME, { type: 'text/plain' })

/** The editor's file input, which its "Choose" button opens. */
const picker = () => {
    const input = dialog.element().querySelector('input[type="file"]')
    if (input === null) {
        throw new Error('The editor has no file input')
    }
    return input
}

/** The small preview drawn in the cell, beside its name. */
const thumbnail = (cell: ReturnType<typeof page.getByRole>) =>
    inputOf(cell).parentElement?.querySelector(':scope > img') ?? null

/** Whether the page asked for a URL ending in `path`, whatever the answer. */
const requested = (path: string) =>
    performance
        .getEntriesByType('resource')
        .some(({ name }) => name.endsWith(path))

const open = async (cell: ReturnType<typeof page.getByRole>) => {
    inputOf(cell).focus()
    // Not Enter, which moves on right after a save.
    await userEvent.keyboard('{F2}')
    await expect.element(dialog).toBeVisible()
}

const leave = async () => {
    await userEvent.click(page.getByText('Age (years)'))
    await expect.element(dialog).not.toBeInTheDocument()
}

const later = (ms: number) =>
    new Promise((resolve) => {
        setTimeout(resolve, ms)
    })

test('a file cell shows the name the form loaded, and asks for none itself', async () => {
    const scan = cellKey('r1', 'c4')
    const form = visitForm({ values: [[scan, STORED]] })
    const [table] = form.tables
    const column: GridColumn = { id: 'c4', label: 'Scan', field: FILE }
    const reads: ServerRequest[] = []
    await mountForm(
        memorySource({
            ...form,
            tables: [
                {
                    ...table,
                    columns: [column, ...table.columns],
                    headerRows: [
                        [
                            { id: 'c4', label: 'Scan', span: 1 },
                            ...table.headerRows[0],
                        ],
                    ],
                },
            ],
            fileNames: NAMES,
        }).source,
        {
            data: {
                fileResources: async (_type, request) => {
                    reads.push(request)
                    return { name: 'Asked for' }
                },
            },
        }
    )
    expect(control(scan)).toHaveValue(STORED_NAME)
    await later(50)
    expect(reads).toEqual([])
})

test('the editor takes focus on "Choose a file", and Tab and Shift+Tab loop over its buttons', async () => {
    const { cell } = await mount(FILE)
    await open(cell)
    // Not the file input the button opens, which is hidden.
    await expect.element(button('Choose a file')).toHaveFocus()
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}')
    await expect.element(button('Cancel')).toHaveFocus()
    await userEvent.keyboard('{Tab}')
    await expect.element(button('Choose a file')).toHaveFocus()
})

test('choosing a file uploads it and saves its id', async () => {
    const { cell, stored, enqueued, announced, uploads, reads, hold } =
        await mount(FILE)
    const release = hold()
    await open(cell)
    await userEvent.upload(picker(), chosen)
    // While it uploads, the editor says so.
    await expect.element(dialog.getByText(`Uploading ${NAME}`)).toBeVisible()
    expect(announced).toEqual([`Uploading ${NAME}`])
    expect(uploads).toHaveLength(1)
    expect(uploads[0].request).toMatchObject({
        resource: 'fileResources',
        data: { domain: 'DATA_VALUE' },
    })
    expect(uploads[0].request.data?.file).toBeInstanceOf(File)
    expect(uploads[0].request.data?.file.name).toBe(NAME)
    expect(stored()?.value).toBeUndefined()

    release()
    await expect.poll(() => stored()?.value).toBe(UPLOADED)
    expect(enqueued).toEqual([[CELL, UPLOADED, null]])
    await expect.element(dialog).not.toBeInTheDocument()
    await expect.element(cell).toHaveFocus()
    // The cell shows the file's name, from the upload's own answer: nothing more is asked.
    await expect.element(cell).toHaveValue(NAME)
    expect(reads).toEqual([])
    // The person saw it finish in the editor: nothing more is said.
    expect(announced).toEqual([`Uploading ${NAME}`])
})

test('offline, the editor says "Connect to the internet to upload files" and uploads nothing', async () => {
    const { cell, stored, uploads, announced } = await mount(FILE, {
        value: STORED,
        sync: 'offline',
    })
    await open(cell)
    await expect.element(dialog.getByText(OFFLINE)).toBeVisible()
    expect(announced).toEqual([OFFLINE])
    // Still reachable, so the reason is found with it, and looking disabled.
    await expect
        .element(button('Choose a file'))
        .toHaveAttribute('aria-disabled', 'true')
    expect(getComputedStyle(button('Choose a file').element()).cursor).toBe(
        'not-allowed'
    )
    await userEvent.upload(picker(), chosen)
    expect(uploads).toEqual([])
    expect(stored()?.value).toBe(STORED)
})

test('an upload that finishes after leaving the cell still saves to that cell', async () => {
    const { cell, stored, enqueued, uploads, announced, hold, drop } =
        await mount(FILE, { value: STORED })
    const release = hold()
    await open(cell)
    await userEvent.upload(picker(), chosen)
    await expect.element(dialog.getByText(`Uploading ${NAME}`)).toBeVisible()
    // A press outside leaves the editor, and the upload goes on.
    await leave()
    expect(uploads[0].signal?.aborted).toBe(false)
    expect(stored()?.value).toBe(STORED)
    await drop()

    release()
    await expect.poll(() => stored()?.value).toBe(UPLOADED)
    expect(enqueued).toEqual([[CELL, UPLOADED, STORED]])
    // No editor shows it finish, so it is said.
    expect(announced.at(-1)).toBe(`Uploaded ${NAME}`)
})

test('an upload the cell refuses once it finishes says why', async () => {
    const { cell, stored, enqueued, effects, announced, hold } = await mount(
        FILE,
        { value: STORED }
    )
    const release = hold()
    await open(cell)
    await userEvent.upload(picker(), chosen)
    await expect.element(dialog.getByText(`Uploading ${NAME}`)).toBeVisible()
    await leave()
    // A rule locks the cell while the upload runs.
    effects.setState({
        cells: { [CELL]: { required: false, messages: [], readOnly: LOCKED } },
    })

    release()
    await expect.poll(() => announced.at(-1)).toBe(`Not saved: ${LOCKED}`)
    expect(stored()?.value).toBe(STORED)
    expect(enqueued).toEqual([])
})

test('Cancel or Escape during an upload stops it and keeps the old value', async () => {
    const { cell, stored, enqueued, uploads, hold } = await mount(FILE, {
        value: STORED,
    })
    const releases = [hold()]
    await open(cell)
    await userEvent.upload(picker(), chosen)
    await expect.element(dialog.getByText(`Uploading ${NAME}`)).toBeVisible()
    await userEvent.click(button('Cancel'))
    await expect.element(dialog).not.toBeInTheDocument()
    expect(uploads[0].signal?.aborted).toBe(true)

    // Escape, wherever focus is in the editor: its own background, where a click leaves it, or the button that is
    // disabled while the upload runs, which takes every key but Tab.
    const focusIn = [
        () => dialog.element(),
        () => button('Choose a file').element(),
    ]
    for (const [at, target] of focusIn.entries()) {
        releases.push(hold())
        await open(cell)
        await userEvent.upload(picker(), chosen)
        await expect
            .element(dialog.getByText(`Uploading ${NAME}`))
            .toBeVisible()
        const element = target()
        if (!(element instanceof HTMLElement)) {
            throw new Error('Nothing to focus')
        }
        element.focus()
        await userEvent.keyboard('{Escape}')
        await expect.element(dialog).not.toBeInTheDocument()
        await expect.element(cell).toHaveFocus()
        expect(uploads[at + 1].signal?.aborted).toBe(true)
    }

    // Answers that come anyway save nothing.
    for (const release of releases) {
        release()
    }
    await later(50)
    expect(stored()?.value).toBe(STORED)
    expect(enqueued).toEqual([])
})

test('"Remove" after leaving an upload stops it: the upload saves nothing when it finishes', async () => {
    const { cell, stored, enqueued, uploads, hold } = await mount(FILE, {
        value: STORED,
    })
    const release = hold()
    await open(cell)
    await userEvent.upload(picker(), chosen)
    await expect.element(dialog.getByText(`Uploading ${NAME}`)).toBeVisible()
    await leave()
    await open(cell)
    await userEvent.click(button('Remove'))
    expect(uploads[0].signal?.aborted).toBe(true)

    release()
    await later(50)
    expect(stored()?.value).toBeUndefined()
    expect(enqueued).toEqual([[CELL, null, STORED]])
})

test('a file chosen while an earlier one still uploads wins, whichever finishes first', async () => {
    const { cell, stored, enqueued, uploads, hold } = await mount(FILE, {
        value: STORED,
    })
    const releaseEarlier = hold()
    await open(cell)
    await userEvent.upload(picker(), chosen)
    await expect.element(dialog.getByText(`Uploading ${NAME}`)).toBeVisible()
    await leave()
    await open(cell)
    const releaseLater = hold(uploadedLater)
    await userEvent.upload(picker(), chosenLater)
    expect(uploads[0].signal?.aborted).toBe(true)

    // The later one finishes first; the earlier one, finishing after, does not replace it.
    releaseLater()
    await expect.poll(() => stored()?.value).toBe(LATER)
    await expect.element(cell).toHaveValue(LATER_NAME)
    releaseEarlier()
    await later(50)
    expect(stored()?.value).toBe(LATER)
    expect(enqueued).toEqual([[CELL, LATER, STORED]])
})

test('a failed upload keeps the old value and shows "Could not upload the file: …"', async () => {
    const { cell, stored, enqueued, announced, answerWith } = await mount(
        FILE,
        { value: STORED }
    )
    answerWith(async () => {
        throw new FetchError({
            type: 'unknown',
            message: 'An unknown error occurred - Bad Request (400)',
            details: refused,
        })
    })
    await open(cell)
    await userEvent.upload(picker(), chosen)
    const reason = `Could not upload the file: ${refused.message}`
    await expect.element(dialog.getByText(reason)).toBeVisible()
    expect(announced).toEqual([`Uploading ${NAME}`, reason])
    expect(stored()?.value).toBe(STORED)

    // The same file again: an answer without the file's id.
    answerWith(async () => ({ status: 'OK' }))
    await userEvent.upload(picker(), chosen)
    const again = 'Could not upload the file. Try again.'
    await expect.element(dialog.getByText(again)).toBeVisible()

    // A dropped connection.
    answerWith(async () => {
        throw new FetchError({
            type: 'network',
            message: 'An unknown network error occurred',
            details: {},
        })
    })
    await userEvent.upload(picker(), chosen)
    await expect.element(dialog.getByText(OFFLINE)).toBeVisible()
    expect(announced.at(-1)).toBe(OFFLINE)
    // Only what DHIS2 said reaches the person, never the platform's or the parser's own text.
    expect(announced.join(' ')).not.toMatch(/unknown|expected|invalid/i)
    expect(stored()?.value).toBe(STORED)
    expect(enqueued).toEqual([])
})

test('"Remove" saves no value', async () => {
    const { cell, stored, enqueued } = await mount(FILE, { value: STORED })
    await open(cell)
    await userEvent.click(button('Remove'))
    expect(stored()?.value).toBeUndefined()
    expect(enqueued).toEqual([[CELL, null, STORED]])
    await expect.element(dialog).not.toBeInTheDocument()
    await expect.element(cell).toHaveValue('')
    // Nothing left to remove.
    await open(cell)
    await expect.element(button('Remove')).not.toBeInTheDocument()
})

test('a stored image shows a preview from the event\'s image endpoint; a file shows its name and "Download"', async () => {
    const image = await mount(IMAGE, { value: STORED })
    await expect.element(image.cell).toHaveValue(STORED_NAME)
    // The cell asks for a small image. The test server has none to give, and a preview that fails to load leaves the
    // name alone, never a broken image.
    await expect
        .poll(() => requested(`${EVENT_IMAGE.slice(2)}?dimension=SMALL`))
        .toBe(true)
    await expect.poll(() => thumbnail(image.cell)).toBeNull()
    expect(inputOf(image.cell).className).not.toContain('ps-10')
    await open(image.cell)
    await expect
        .element(dialog.getByRole('img', { name: STORED_NAME }))
        .toHaveAttribute('src', EVENT_IMAGE)
    await expect.element(button('Choose an image')).toBeVisible()
    expect(picker().getAttribute('accept')).toBe('image/*')
    // A new image DHIS2 does not hold for the event yet shows its name.
    await userEvent.upload(picker(), chosen)
    await expect.poll(() => image.stored()?.value).toBe(UPLOADED)
    expect(thumbnail(image.cell)).toBeNull()
    await open(image.cell)
    await expect.element(dialog.getByText(NAME)).toBeVisible()
    await expect.element(dialog.getByRole('img')).not.toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    await image.screen.unmount()

    const file = await mount(FILE, { value: STORED })
    await expect.element(file.cell).toHaveValue(STORED_NAME)
    expect(thumbnail(file.cell)).toBeNull()
    await open(file.cell)
    await expect.element(dialog.getByText(STORED_NAME)).toBeVisible()
    await expect
        .element(dialog.getByRole('link', { name: 'Download' }))
        .toHaveAttribute('href', EVENT_FILE)
    expect(picker().hasAttribute('accept')).toBe(false)
})
