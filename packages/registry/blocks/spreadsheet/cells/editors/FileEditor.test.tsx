/// <reference types="@vitest/browser-playwright" />
import { FetchError } from '@dhis2/app-runtime'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import type { Field } from '@/components/dhis2-value-types'
import refused from '../test/fixtures/file-upload-refused.json'
import uploaded from '../test/fixtures/file-upload.json'
import { CELL, HEADER, inputOf, rig } from '../test/harness'
import type { ServerRequest } from '../test/harness'
import { Cell } from '../Cell'

const FILE: Field = { valueType: 'FILE_RESOURCE' }
const IMAGE: Field = { valueType: 'IMAGE' }
const STORED = 'Yqp5K9rz3I2'
const STORED_NAME = 'doc.pdf'
const NAMES = new Map([[STORED, STORED_NAME]])
const UPLOADED = uploaded.response.fileResource.id
const NAME = uploaded.response.fileResource.name
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
const STORED_FILE = '../files/r1.c1/file'
const STORED_IMAGE = '../files/r1.c1/image'
const fileUrl = (key: string, image: boolean) =>
    `../files/${key}/${image ? 'image' : 'file'}`

type Answer = () => Promise<{ status: string }>

interface Upload {
    request: ServerRequest
    signal?: AbortSignal
}

const mount = async (field: Field, options: Parameters<typeof rig>[1] = {}) => {
    const uploads: Upload[] = []
    const uploadSignals = new Map<number, PromiseWithResolvers<void>>()
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
                uploadSignals.get(uploads.length)?.resolve()
                uploadSignals.delete(uploads.length)
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
        uploadStarted(number: number) {
            if (uploads.length >= number) {
                return Promise.resolve()
            }
            const started = Promise.withResolvers<void>()
            uploadSignals.set(number, started)
            return started.promise
        },
        reads,
        screen,
        cell: page.getByRole('textbox', { name: 'Age (years)' }),
        answerWith(next: Answer) {
            answer = next
        },
        hold(answered: { status: string } = uploaded) {
            let release = () => {}
            answer = () =>
                new Promise((resolve) => {
                    release = () => resolve(answered)
                })
            return () => release()
        },
        async drop() {
            await screen.rerender(setup.ui(null))
        },
    }
}

const dialog = page.getByRole('dialog', { name: 'Edit Age (years)' })
const button = (name: string) => dialog.getByRole('button', { name })
const chosen = new File(['x'], NAME, { type: 'text/plain' })
const chosenLater = new File(['y'], LATER_NAME, { type: 'text/plain' })
const chosenImage = new File(['x'], 'scan.png', { type: 'image/png' })

const picker = () => {
    const input = dialog.element().querySelector('input[type="file"]')
    if (input === null) {
        throw new Error('The editor has no file input')
    }
    return input
}

const thumbnail = (cell: ReturnType<typeof page.getByRole>) =>
    inputOf(cell).parentElement?.querySelector(':scope > img') ?? null

const requested = (path: string) =>
    performance
        .getEntriesByType('resource')
        .some(({ name }) => name.endsWith(path))

const open = async (cell: ReturnType<typeof page.getByRole>) => {
    inputOf(cell).focus()
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

test('the editor takes focus on "Choose a file", and Tab and Shift+Tab loop over its buttons', async () => {
    const { cell } = await mount(FILE)
    await open(cell)
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
    await expect.element(cell).toHaveValue(NAME)
    expect(reads).toEqual([])
    expect(announced).toEqual([`Uploading ${NAME}`])
})

test('an image cell does not upload a file that is not an image, and says so at once as it does a failed upload', async () => {
    const { cell, stored, enqueued, uploads, uploadStarted, announced, hold } =
        await mount(IMAGE)
    await open(cell)
    await userEvent.upload(picker(), chosen)
    await expect.element(dialog.getByText('Choose an image file')).toBeVisible()
    expect(announced).toEqual(['Choose an image file'])
    expect(uploads).toEqual([])
    expect(stored()?.value).toBeUndefined()
    expect(enqueued).toEqual([])

    const untyped = new DataTransfer()
    untyped.items.add(new File(['x'], 'photo.heic'))
    Object.assign(picker(), { files: untyped.files })
    picker().dispatchEvent(new Event('change', { bubbles: true }))
    await expect.poll(() => stored()?.value).toBe(UPLOADED)
    expect(uploads).toHaveLength(1)

    const release = hold()
    await open(cell)
    await userEvent.upload(picker(), chosenImage)
    await expect.element(dialog.getByText('Uploading scan.png')).toBeVisible()
    await userEvent.upload(picker(), chosen)
    await expect.element(dialog.getByText('Choose an image file')).toBeVisible()
    release()
    await uploadStarted(2)
    expect(uploads).toHaveLength(2)
})

test('offline, the editor says uploads wait', async () => {
    const { cell, stored, uploads, announced } = await mount(FILE, {
        value: STORED,
        offline: true,
    })
    await open(cell)
    await expect.element(dialog.getByText(OFFLINE)).toBeVisible()
    expect(announced).toEqual([OFFLINE])
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
    await leave()
    expect(uploads[0].signal?.aborted).toBe(false)
    expect(stored()?.value).toBe(STORED)
    await drop()

    release()
    await expect.poll(() => stored()?.value).toBe(UPLOADED)
    expect(enqueued).toEqual([[CELL, UPLOADED, STORED]])
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

    answerWith(async () => ({ status: 'OK' }))
    await userEvent.upload(picker(), chosen)
    const again = 'Could not upload the file. Try again.'
    await expect.element(dialog.getByText(again)).toBeVisible()

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
    await open(cell)
    await expect.element(button('Remove')).not.toBeInTheDocument()
})

test('without `fileUrl`, a stored image or file shows its name only: no preview, no "Download"', async () => {
    const image = await mount(IMAGE, { value: STORED })
    await expect.element(image.cell).toHaveValue(STORED_NAME)
    expect(thumbnail(image.cell)).toBeNull()
    await open(image.cell)
    await expect.element(dialog.getByText(STORED_NAME)).toBeVisible()
    await expect.element(dialog.getByRole('img')).not.toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    await image.screen.unmount()
    expect(requested('?dimension=SMALL')).toBe(false)
    expect(requested('?dimension=MEDIUM')).toBe(false)

    const file = await mount(FILE, { value: STORED })
    await open(file.cell)
    await expect.element(dialog.getByText(STORED_NAME)).toBeVisible()
    await expect
        .element(dialog.getByRole('link', { name: 'Download' }))
        .not.toBeInTheDocument()
})

test('a stored image shows a preview from `fileUrl`; a file shows its name and "Download" from it', async () => {
    const image = await mount(IMAGE, { value: STORED, fileUrl })
    await expect.element(image.cell).toHaveValue(STORED_NAME)
    await expect
        .poll(() => requested(`${STORED_IMAGE.slice(2)}?dimension=SMALL`))
        .toBe(true)
    await expect.poll(() => thumbnail(image.cell)).toBeNull()
    expect(inputOf(image.cell).className).not.toContain('ps-10')
    await open(image.cell)
    await expect
        .poll(() => requested(`${STORED_IMAGE.slice(2)}?dimension=MEDIUM`))
        .toBe(true)
    await expect.element(dialog.getByText(STORED_NAME)).toBeVisible()
    await expect.element(dialog.getByRole('img')).not.toBeInTheDocument()
    await expect.element(button('Choose an image')).toBeVisible()
    expect(picker().getAttribute('accept')).toBe('image/*')
    await userEvent.upload(picker(), chosenImage)
    await expect.poll(() => image.stored()?.value).toBe(UPLOADED)
    expect(thumbnail(image.cell)).toBeNull()
    await open(image.cell)
    await expect.element(dialog.getByText(NAME)).toBeVisible()
    await expect.element(dialog.getByRole('img')).not.toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    await image.screen.unmount()

    const file = await mount(FILE, { value: STORED, fileUrl })
    await expect.element(file.cell).toHaveValue(STORED_NAME)
    expect(thumbnail(file.cell)).toBeNull()
    await open(file.cell)
    await expect.element(dialog.getByText(STORED_NAME)).toBeVisible()
    const download = dialog.getByRole('link', { name: 'Download' })
    await expect.element(download).toHaveAttribute('href', STORED_FILE)
    await expect.element(download).toHaveAttribute('target', '_blank')
    await expect.element(download).toHaveAttribute('rel', 'noopener')
    expect(picker().hasAttribute('accept')).toBe(false)
})
