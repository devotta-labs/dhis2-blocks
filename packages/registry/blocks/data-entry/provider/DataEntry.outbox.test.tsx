/// <reference types="@vitest/browser-playwright" />
import { FetchError } from '@dhis2/app-runtime'
import { userEvent } from 'vitest/browser'
import { control } from '../grid/__tests__/gridRig'
import { cellKey } from '../model/types'
import {
    catchDownloads,
    change,
    cleanUp,
    freshServer,
    KEY,
    leaving,
    memorySource,
    mount,
    notesOf,
    records,
    visitForm,
    withOutbox,
} from './__tests__/rig'

afterEach(cleanUp)

const CHILDREN = cellKey('r1', 'c1')

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

test('unsent changes are only ever sent for the user who made them', async () => {
    let user = 'userA'
    const memory = memorySource(visitForm())
    const { server, view } = await mount(memory.source, {
        signedIn: () => user,
    })
    // Another tab signs in as someone else; the session cookie is shared.
    user = 'userB'
    control(CHILDREN).focus()
    await userEvent.keyboard('5{Enter}')
    await expect.poll(() => view().sync).toBe('signIn')
    expect(memory.sent).toEqual([])
    expect(await records(server, KEY)).toMatchObject([
        { key: CHILDREN, value: '5', state: 'queued' },
    ])

    user = 'userA'
    control(cellKey('r2', 'c1')).focus()
    await userEvent.keyboard('6{Enter}')
    await expect.poll(() => view().summary.unsent).toBe(0)
    expect(memory.sent.flat().map(({ value }) => value)).toEqual(['5', '6'])
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

test('another form’s unsent changes stay in the outbox, unsent and not shown', async () => {
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
