import { cellAt } from '@/components/spreadsheet'
/// <reference types="@vitest/browser-playwright" />
import { cellKey } from '@/components/spreadsheet'
import { outboxName } from '../outbox/outbox'
import {
    change,
    cleanUp,
    freshServer,
    holdPaint,
    memorySource,
    mount,
    records,
    USER,
    visitForm,
    withOutbox,
} from './__tests__/rig'

afterEach(cleanUp)

const CHILDREN = cellKey('r1', 'c1')

test('a restored change’s base is the value just loaded', async () => {
    const server = freshServer()
    await withOutbox(server, (outbox) =>
        outbox.put(change(CHILDREN, 'v2', { base: 'b0' }))
    )
    const memory = memorySource(visitForm({ values: [[CHILDREN, 'v1']] }))
    // Held, so the change stays unsent while it is read.
    memory.hold()
    const { context } = await mount(memory.source, { server })
    expect(cellAt(context().store.getState().cells, CHILDREN)).toMatchObject({
        value: 'v2',
        base: 'v1',
    })
})

test('a restored change whose cell the load did not carry has no base', async () => {
    const server = freshServer()
    await withOutbox(server, (outbox) =>
        outbox.put(change(CHILDREN, 'v2', { base: 'b0' }))
    )
    const memory = memorySource(visitForm())
    memory.hold()
    const { context } = await mount(memory.source, { server })
    // The store keeps a `null` base as none.
    expect(cellAt(context().store.getState().cells, CHILDREN)).toMatchObject({
        value: 'v2',
        base: undefined,
    })
})

test('close during a save still removes the saved record and tells other tabs', async () => {
    const server = freshServer()
    await withOutbox(server, (outbox) => outbox.put(change(CHILDREN, '5')))
    const memory = memorySource(visitForm())
    memory.hold()
    const { screen } = await mount(memory.source, { server })
    await expect.poll(() => memory.sent).toHaveLength(1)
    // Another tab, listening on the channel the form posts its outcomes on.
    const heard: unknown[] = []
    const tab = new BroadcastChannel(outboxName(server, USER))
    tab.onmessage = ({ data }) => heard.push(data)
    try {
        screen.unmount()
        memory.release()
        await expect.poll(() => heard).toHaveLength(1)
        expect(heard[0]).toMatchObject({
            outcomes: [{ key: CHILDREN, result: 'saved', value: '5' }],
        })
        expect(await records(server)).toEqual([])
    } finally {
        tab.close()
    }
})

test('a summary still waiting for a paint when the form closes never reaches the view', async () => {
    const memory = memorySource(visitForm({ values: [[CHILDREN, '1']] }))
    memory.hold()
    const { context, view, screen } = await mount(memory.source)
    const { store } = context()
    holdPaint()
    store.getState().commit(CHILDREN, '2')
    // Completing waits for the record's change, whose save is held.
    const completing = view()
        .complete('r1')
        .catch(() => [])
    await expect.poll(() => memory.sent).toHaveLength(1)
    store.getState().commit(cellKey('r2', 'c1'), '3')
    screen.unmount()
    const closedWith = view().summary
    // The change is sent: completion checks the record again, and asks for the summary first.
    store.getState().markSync([{ key: CHILDREN, value: '2' }], 'saved')
    await completing
    expect(view().summary).toBe(closedWith)
})
