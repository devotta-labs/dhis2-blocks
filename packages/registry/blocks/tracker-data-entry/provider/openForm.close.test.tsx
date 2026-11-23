/// <reference types="@vitest/browser-playwright" />
import { cellKey } from '@/components/spreadsheet'
import { outboxName } from '../outbox/outbox'
import {
    change,
    cleanUp,
    freshServer,
    memorySource,
    mount,
    records,
    USER,
    visitForm,
    withOutbox,
} from './test/rig'

afterEach(cleanUp)

const CHILDREN = cellKey('r1', 'c1')

test('a restored change’s base is the value just loaded', async () => {
    const server = freshServer()
    await withOutbox(server, (outbox) =>
        outbox.put(change(CHILDREN, 'v2', { base: 'b0' }))
    )
    const memory = memorySource(visitForm({ values: [[CHILDREN, 'v1']] }))
    memory.hold()
    const { context } = await mount(memory.source, { server })
    expect(context().store.getState().cells[CHILDREN]).toMatchObject({
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
    expect(context().store.getState().cells[CHILDREN]).toMatchObject({
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
    await memory.saveCount(1)
    expect(memory.sent).toHaveLength(1)
    const heard = Promise.withResolvers<MessageEvent>()
    const tab = new BroadcastChannel(outboxName(server, USER))
    tab.onmessage = heard.resolve
    try {
        screen.unmount()
        memory.release()
        expect((await heard.promise).data).toMatchObject({
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
    store.getState().commit(CHILDREN, '2')
    const completing = view()
        .complete('r1')
        .catch(() => [])
    await memory.saveCount(1)
    expect(memory.sent).toHaveLength(1)
    const beforeCommit = view().summary
    store.getState().commit(cellKey('r2', 'c1'), '3')
    expect(view().summary).toBe(beforeCommit)
    screen.unmount()
    const closedWith = view().summary
    store.getState().markSync([{ key: CHILDREN, value: '2' }], 'saved')
    await completing
    expect(view().summary).toBe(closedWith)
})
