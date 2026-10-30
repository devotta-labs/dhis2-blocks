/// <reference types="@vitest/browser-playwright" />
import { FetchError } from '@dhis2/app-runtime'
import { page, userEvent } from 'vitest/browser'
import { DataGrid } from '../grid/DataGrid'
import { control } from '../grid/__tests__/gridRig'
import { cellKey } from '../model/types'
import { outboxName } from '../outbox/outbox'
import type { DataEntrySource } from '../sources/types'
import { DataEntrySummary } from '../summary/DataEntrySummary'
import {
    catchDownloads,
    change,
    cleanUp,
    freshServer,
    holdPaint,
    KEY,
    later,
    leaving,
    memorySource,
    mount,
    notesOf,
    records,
    USER,
    visit,
    visitForm,
    withOutbox,
} from './__tests__/rig'

afterEach(cleanUp)

const CHILDREN = cellKey('r1', 'c1')
const LOCKED = 'Signed in as someone else. Reload to continue as that user.'
const DISCARD = 'Discard changes that could not be saved'
const lapsed = () =>
    new FetchError({
        type: 'access',
        message: 'Unauthorized',
        details: { httpStatusCode: 401 },
    })

test('a change the device could not store is not saved, says so, keeps the leave prompt and is in the download', async () => {
    const { context, view } = await mount(memorySource(visitForm()).source)
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => {
        throw new DOMException('The quota was exceeded', 'QuotaExceededError')
    })
    control(CHILDREN).focus()
    await userEvent.keyboard('5{Enter}')
    await expect
        .poll(() => context().store.getState().cells[CHILDREN]?.sync)
        .toBe('failed')
    expect(notesOf(CHILDREN)).toEqual([
        'Not saved: This device could not store the change',
    ])
    // Only this page holds the value now.
    expect(leaving()).toBe(true)
    const files = catchDownloads()
    view().downloadUnsent()
    await expect.poll(() => files).toHaveLength(1)
    expect(await files[0].text()).toBe(
        'form,row,field,value,state,reason\nVisits,Visit 1,Children,5,failed,This device could not store the change\n'
    )
})

test('once someone else signs in, the form locks: the first user’s unsent changes are neither shown nor sent', async () => {
    const server = freshServer()
    await withOutbox(server, (outbox) => outbox.put(change('r2.c1', '8')))
    let user = 'userA'
    const memory = memorySource(visitForm({ values: [[CHILDREN, '1']] }))
    memory.fail()
    const { view } = await mount(memory.source, {
        server,
        signedIn: () => user,
        children: (
            <>
                <DataGrid />
                <DataEntrySummary />
            </>
        ),
    })
    expect(control(cellKey('r2', 'c1'))).toHaveValue('8')
    await expect.poll(() => view().sync).toBe('retrying')
    const tries = memory.sent.length

    // Another tab signs in as someone else; the session cookie is shared.
    user = 'userB'
    control(CHILDREN).focus()
    await userEvent.keyboard('5{Enter}')
    await expect
        .poll(() => notesOf(CHILDREN), { timeout: 5000 })
        .toContain(LOCKED)
    // What DHIS2 had, read-only, and why: nothing is left to send or to warn about.
    expect(control(CHILDREN)).toHaveValue('1')
    expect(control(CHILDREN).hasAttribute('readonly')).toBe(true)
    expect(control(cellKey('r2', 'c1'))).toHaveValue('')
    expect(view()).toMatchObject({
        sync: 'idle',
        summary: {
            unsent: 0,
            failed: 0,
            items: [{ kind: 'error', text: LOCKED }],
        },
    })
    expect(leaving()).toBe(false)
    expect(await view().complete('r1')).toMatchObject([{ reason: LOCKED }])
    await later(1500)
    expect(memory.sent).toHaveLength(tries)
    // Both stay on this device for their user.
    expect(await records(server, KEY)).toMatchObject([
        { key: CHILDREN, value: '5', state: 'queued' },
        { key: 'r2.c1', value: '8', state: 'queued' },
    ])
})

test('the form locks too when the account, asked again, names someone else', async () => {
    let user = 'userA'
    const memory = memorySource(visitForm())
    const { client, view } = await mount(memory.source, {
        signedIn: () => user,
    })
    user = 'userB'
    await client.refetchQueries()
    await expect.poll(() => notesOf(CHILDREN)).toContain(LOCKED)
    expect(view().status).toBe('ready')
    // Until a reload, whoever the account names next.
    user = 'userA'
    await client.refetchQueries()
    await later(200)
    expect(notesOf(CHILDREN)).toContain(LOCKED)
})

test('a status waiting for the sync lock when someone else signs in is refused as signed in as someone else', async () => {
    let user = USER
    const memory = memorySource(
        visitForm({
            rows: [visit('r1', 'Visit 1'), visit('r2', 'Visit 2', 'COMPLETED')],
            canReopen: ['r2'],
        })
    )
    const { server, view } = await mount(memory.source, {
        signedIn: () => user,
    })
    // Another tab's loop, sending.
    const holder = Promise.withResolvers<void>()
    await new Promise<void>((granted) => {
        void navigator.locks.request(
            `dhis2-data-entry-sync:${outboxName(server, USER)}`,
            () => {
                granted()
                return holder.promise
            }
        )
    })
    const reopening = view().reopen('r2')
    await later(300)
    // Someone else signs in; the next request that asks who it is stops this form's loop.
    user = 'userB'
    expect(await view().complete('r1')).toMatchObject([{ reason: LOCKED }])
    expect(await reopening).toMatchObject([
        { key: cellKey('r2', 'status'), result: 'failed', reason: LOCKED },
    ])
    holder.resolve()
    expect(memory.statuses).toEqual([])
})

test('a failure asking for the account again leaves the form as it was', async () => {
    let answer: string | FetchError = 'userA'
    const { client, view } = await mount(memorySource(visitForm()).source, {
        signedIn: () => answer,
    })
    answer = lapsed()
    await client.refetchQueries()
    await later(100)
    expect(view().status).toBe('ready')
    expect(control(CHILDREN).hasAttribute('readonly')).toBe(false)
})

test('the download keeps a newer change the device could not store beside the older one it holds', async () => {
    const memory = memorySource(visitForm())
    memory.hold()
    const { server, view } = await mount(memory.source)
    control(CHILDREN).focus()
    await userEvent.keyboard('5{Enter}')
    await expect.poll(() => records(server, KEY)).toHaveLength(1)
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => {
        throw new DOMException('The quota was exceeded', 'QuotaExceededError')
    })
    control(CHILDREN).focus()
    await userEvent.keyboard('6{Enter}')
    await expect
        .poll(() => notesOf(CHILDREN))
        .toEqual(['Not saved: This device could not store the change'])
    const files = catchDownloads()
    view().downloadUnsent()
    await expect.poll(() => files).toHaveLength(1)
    expect(await files[0].text()).toBe(
        'form,row,field,value,state,reason\n' +
            'Visits,Visit 1,Children,5,queued,\n' +
            'Visits,Visit 1,Children,6,failed,This device could not store the change\n'
    )
})

test('a failure asking who is signed in never refuses the changes; they wait and are sent', async () => {
    let answer: string | Error = 'userA'
    const memory = memorySource(visitForm())
    const { server, view, meSignals } = await mount(memory.source, {
        signedIn: () => answer,
    })
    answer = new FetchError({
        type: 'access',
        message: 'Forbidden',
        details: { httpStatusCode: 403 },
    })
    const asked = meSignals.length
    control(CHILDREN).focus()
    await userEvent.keyboard('5{Enter}')
    await expect.poll(() => view().sync).toBe('retrying')
    expect(await records(server, KEY)).toMatchObject([
        { key: CHILDREN, state: 'queued' },
    ])
    // Asked within the save's time limit.
    expect(meSignals.slice(asked)).not.toContain(undefined)

    answer = 'userA'
    await expect.poll(() => view().summary.unsent, { timeout: 5000 }).toBe(0)
    expect(memory.sent.flat().map(({ value }) => value)).toEqual(['5'])
})

test('unsent changes come back in the state they were left in; failed ones are not sent again', async () => {
    const server = freshServer()
    await withOutbox(server, async (outbox) => {
        await outbox.putMany([
            change('r1.c1', '7', { at: 1 }),
            change('r2.c1', '8', { at: 2 }),
            change('r1.c3', 'Seen', { at: 3 }),
        ])
        await outbox.mark(
            [{ sourceKey: KEY, key: 'r1.c1' }],
            'failed',
            'Too high'
        )
        await outbox.mark(
            [{ sourceKey: KEY, key: 'r2.c1' }],
            'waiting',
            'Waiting for required fields: Notes'
        )
    })
    const memory = memorySource(visitForm())
    memory.hold()
    const { view } = await mount(memory.source, { server })
    expect(notesOf(CHILDREN)).toEqual(['Not saved: Too high'])
    expect(notesOf(cellKey('r2', 'c1'))).toEqual([
        'Waiting for required fields: Notes',
        'Saved on this device',
    ])
    expect(notesOf(cellKey('r1', 'c3'))).toEqual(['Saved on this device'])
    expect(view().summary).toMatchObject({ unsent: 2, failed: 1 })
    // A row with a refused or waiting change cannot be completed until it is fixed.
    expect(await view().complete('r1')).toEqual([
        {
            sourceKey: KEY,
            key: CHILDREN,
            result: 'failed',
            reason: 'Not saved: Too high',
        },
    ])
    expect(await view().complete('r2')).toMatchObject([
        { key: 'r2.c1', reason: 'Waiting for required fields: Notes' },
    ])
    await expect
        .poll(() => memory.sent.map((sent) => sent.map(({ key }) => key)))
        .toEqual([['r2.c1', 'r1.c3']])
})

test('another program’s unsent changes stay in the outbox, unsent and not shown', async () => {
    const server = freshServer()
    const theirs = change('x1.c1', '9', { sourceKey: 'memory:other' })
    await withOutbox(server, (outbox) => outbox.put(theirs))
    const memory = memorySource(visitForm())
    const { view, context } = await mount(memory.source, { server })
    control(CHILDREN).focus()
    await userEvent.keyboard('5{Enter}')
    await expect.poll(() => view().summary.unsent).toBe(0)
    await expect.poll(() => view().sync).toBe('idle')
    expect(memory.sent.flat().map(({ sourceKey }) => sourceKey)).toEqual([KEY])
    expect(await records(server)).toEqual([{ ...theirs, state: 'queued' }])
    expect(context().store.getState().cells['x1.c1']).toBeUndefined()
})

test('a change made in the same millisecond as the one being sent is kept and sent next', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(5000)
    const memory = memorySource(visitForm())
    memory.hold()
    const { server, context } = await mount(memory.source)
    control(CHILDREN).focus()
    await userEvent.keyboard('5{Enter}')
    await expect.poll(() => memory.sent).toHaveLength(1)
    control(CHILDREN).focus()
    await userEvent.keyboard('6{Enter}')
    await expect
        .poll(() => records(server, KEY))
        .toMatchObject([{ value: '6', at: 5001 }])
    memory.release()
    await expect
        .poll(() => context().store.getState().cells[CHILDREN])
        .toMatchObject({ value: '6', base: '6', sync: 'saved' })
    expect(memory.sent.map((sent) => sent.map(({ value }) => value))).toEqual([
        ['5'],
        ['6'],
    ])
})

test('outcomes another tab’s loop received reach this tab’s cells', async () => {
    const server = freshServer()
    const sender = memorySource(visitForm())
    const offline = memorySource(visitForm())
    offline.fail()
    const first = await mount(sender.source, { server, children: null })
    const second = await mount(offline.source, { server, children: null })

    // The second tab cannot send, so its change waits in the outbox the tabs share.
    second.context().store.getState().commit(CHILDREN, '5')
    await expect.poll(() => offline.sent).toHaveLength(1)
    expect(second.context().store.getState().cells[CHILDREN]?.sync).toBe(
        'queued'
    )
    // The first tab's next round sends it, and tells the other tabs.
    first.context().store.getState().commit(cellKey('r1', 'c3'), 'Seen')
    await expect
        .poll(() => second.context().store.getState().cells[CHILDREN])
        .toMatchObject({ value: '5', base: '5', sync: 'saved' })
    expect(sender.sent.flat().map(({ key }) => key)).toContain(CHILDREN)
})

const refusing = (source: DataEntrySource): DataEntrySource => ({
    ...source,
    save: async (_engine, sent) =>
        sent.map(({ sourceKey, key }) => ({
            sourceKey,
            key,
            result: 'failed',
            reason: 'Too high',
        })),
})

test.each([
    [
        'saved',
        (source: DataEntrySource) => source,
        { value: '2', base: '2', sync: 'saved' },
        { unsent: 0, failed: 0 },
    ],
    [
        'refused',
        refusing,
        { value: '2', base: '0', sync: 'failed', reason: 'Too high' },
        { unsent: 0, failed: 1 },
    ],
])(
    'a cell another tab changed later shows that tab’s value as %s',
    async (_, sourceOf, cell, summary) => {
        const server = freshServer()
        const form = () => visitForm({ values: [[CHILDREN, '0']] })
        const offline = memorySource(form())
        offline.fail()
        const here = await mount(offline.source, { server, children: null })
        const there = await mount(sourceOf(memorySource(form()).source), {
            server,
            children: null,
        })
        here.context().store.getState().commit(CHILDREN, '1')
        await expect
            .poll(() => records(server, KEY))
            .toMatchObject([{ value: '1' }])
        // The newer change replaces this tab's in the outbox; the other tab sends it.
        there.context().store.getState().commit(CHILDREN, '2')
        await expect
            .poll(() => here.context().store.getState().cells[CHILDREN])
            .toMatchObject(cell)
        expect(here.view().summary).toMatchObject(summary)
    }
)

test('a draft held here survives another tab’s saved value, which is under it', async () => {
    const server = freshServer()
    const form = () => visitForm({ values: [[CHILDREN, '0']] })
    const here = await mount(memorySource(form()).source, {
        server,
        children: null,
    })
    const there = await mount(memorySource(form()).source, {
        server,
        children: null,
    })
    // Not a whole number: kept here as a draft with its error, and nothing is sent.
    here.context().store.getState().commit(CHILDREN, 'abc')
    const held = here.context().store.getState().cells[CHILDREN]
    expect(held).toMatchObject({ draft: 'abc', error: expect.any(String) })
    there.context().store.getState().commit(CHILDREN, '2')
    await expect
        .poll(() => here.context().store.getState().cells[CHILDREN])
        .toMatchObject({
            value: '2',
            base: '2',
            sync: 'saved',
            draft: 'abc',
            error: held?.error,
        })
})

/** Another tab opens a newer version of the outbox: this page's connection closes itself. */
const upgradeOutbox = (server: string) =>
    new Promise<void>((resolve, reject) => {
        const opening = indexedDB.open(outboxName(server, USER), 2)
        opening.onsuccess = () => {
            opening.result.close()
            resolve()
        }
        opening.onerror = () => reject(opening.error)
    })

test('the download still holds what only this page has once its outbox has closed', async () => {
    const { server, context, view } = await mount(
        memorySource(visitForm()).source
    )
    await upgradeOutbox(server)
    control(CHILDREN).focus()
    await userEvent.keyboard('5{Enter}')
    await expect
        .poll(() => context().store.getState().cells[CHILDREN]?.sync)
        .toBe('failed')
    const files = catchDownloads()
    view().downloadUnsent()
    await expect.poll(() => files).toHaveLength(1)
    expect(await files[0].text()).toBe(
        'form,row,field,value,state,reason\nVisits,Visit 1,Children,5,failed,This device could not store the change\n'
    )
})

test('the unsent changes download as UTF-8 that Excel reads', async () => {
    const memory = memorySource(visitForm())
    memory.hold()
    const { server, view } = await mount(memory.source)
    control(CHILDREN).focus()
    await userEvent.keyboard('5{Enter}')
    await expect.poll(() => records(server, KEY)).toHaveLength(1)
    const files = catchDownloads()
    view().downloadUnsent()
    await expect.poll(() => files).toHaveLength(1)
    const bytes = new Uint8Array(await files[0].arrayBuffer())
    expect(Array.from(bytes.subarray(0, 3))).toEqual([0xef, 0xbb, 0xbf])
    // `text()` drops the byte order mark.
    expect(await files[0].text()).toBe(
        'form,row,field,value,state,reason\nVisits,Visit 1,Children,5,queued,\n'
    )
})

test('discarding the changes that could not be saved takes them off the device and disarms the leave prompt', async () => {
    const server = freshServer()
    await withOutbox(server, async (outbox) => {
        await outbox.putMany([
            change(CHILDREN, '7', { base: '1', at: 1 }),
            change('r2.c1', '8', { at: 2 }),
        ])
        await outbox.mark(
            [{ sourceKey: KEY, key: CHILDREN }],
            'failed',
            'Too high'
        )
    })
    const memory = memorySource(visitForm({ values: [[CHILDREN, '1']] }))
    memory.hold()
    const { view } = await mount(memory.source, {
        server,
        children: (
            <>
                <DataGrid />
                <DataEntrySummary />
            </>
        ),
    })
    expect(control(CHILDREN)).toHaveValue('7')
    await userEvent.click(page.getByRole('button', { name: DISCARD }))
    const dialog = page.getByRole('alertdialog', { name: 'Discard 1 changes?' })
    await expect
        .element(dialog)
        .toHaveTextContent(
            'They are not saved anywhere else. Download them first to keep a copy.'
        )
    await userEvent.click(dialog.getByRole('button', { name: 'Discard' }))
    // Only the failed change goes; the one waiting to be sent stays.
    await expect
        .poll(() => records(server, KEY))
        .toMatchObject([{ key: 'r2.c1', state: 'queued' }])
    expect(control(CHILDREN)).toHaveValue('1')
    expect(view().summary.failed).toBe(0)
    expect(page.getByRole('button', { name: DISCARD }).query()).toBeNull()
    memory.release()
    await expect.poll(leaving).toBe(false)
})

test('discarding a change the device could not store puts back the older one it holds', async () => {
    const memory = memorySource(visitForm())
    memory.hold()
    const { server, view, context } = await mount(memory.source)
    control(CHILDREN).focus()
    await userEvent.keyboard('5{Enter}')
    await expect.poll(() => records(server, KEY)).toHaveLength(1)
    const put = vi
        .spyOn(IDBObjectStore.prototype, 'put')
        .mockImplementation(() => {
            throw new DOMException(
                'The quota was exceeded',
                'QuotaExceededError'
            )
        })
    control(CHILDREN).focus()
    await userEvent.keyboard('6{Enter}')
    await expect.poll(() => view().summary.failed).toBe(1)
    put.mockRestore()
    await view().discardFailed()
    expect(context().store.getState().cells[CHILDREN]).toMatchObject({
        value: '5',
        sync: 'queued',
    })
    expect(await records(server, KEY)).toMatchObject([{ value: '5' }])
})

test('leaving or hiding the page stores a change at once, without waiting for a paint', async () => {
    const memory = memorySource(visitForm())
    memory.hold()
    const { server } = await mount(memory.source)
    holdPaint()
    control(CHILDREN).focus()
    await userEvent.keyboard('5{Enter}')
    await later(200)
    expect(await records(server, KEY)).toEqual([])
    window.dispatchEvent(new PageTransitionEvent('pagehide'))
    await expect
        .poll(() => records(server, KEY))
        .toMatchObject([{ key: CHILDREN, value: '5' }])

    control(cellKey('r2', 'c1')).focus()
    await userEvent.keyboard('6{Enter}')
    await later(200)
    expect(await records(server, KEY)).toHaveLength(1)
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    await expect.poll(() => records(server, KEY)).toHaveLength(2)
})

test('sending paused for signing in starts again when the person comes back to the page', async () => {
    let answer: string | FetchError = 'userA'
    const memory = memorySource(visitForm())
    const { view } = await mount(memory.source, { signedIn: () => answer })
    answer = lapsed()
    control(CHILDREN).focus()
    await userEvent.keyboard('5{Enter}')
    await expect.poll(() => view().sync).toBe('signIn')
    // Signed in again, in another tab.
    answer = 'userA'
    window.dispatchEvent(new FocusEvent('focus'))
    await expect.poll(() => view().summary.unsent).toBe(0)

    answer = lapsed()
    control(cellKey('r2', 'c1')).focus()
    await userEvent.keyboard('6{Enter}')
    await expect.poll(() => view().sync).toBe('signIn')
    answer = 'userA'
    const visibility = vi.spyOn(document, 'visibilityState', 'get')
    visibility.mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    visibility.mockReturnValue('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    await expect.poll(() => view().summary.unsent).toBe(0)
    expect(memory.sent.flat().map(({ value }) => value)).toEqual(['5', '6'])
})
