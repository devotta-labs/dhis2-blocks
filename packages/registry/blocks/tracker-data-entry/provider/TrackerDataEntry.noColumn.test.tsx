/// <reference types="@vitest/browser-playwright" />
import { captureNextDownload } from '../../../test/download.test-utils'
import { cellKey } from '@/components/spreadsheet'
import {
    change,
    cleanUp,
    freshServer,
    HIDDEN_FIELD,
    later,
    memorySource,
    mount,
    visitForm,
    withOutbox,
} from './test/rig'

afterEach(cleanUp)

test('an unsent value a rule gave a field no column shows comes back on its cell and is in the download', async () => {
    const server = freshServer()
    const hidden = cellKey('r1', HIDDEN_FIELD)
    await withOutbox(server, (outbox) => outbox.put(change(hidden, '5')))
    const memory = memorySource(visitForm())
    memory.hold()
    const { context, view } = await mount(memory.source, { server })
    expect(context().store.getState().cells[hidden]).toMatchObject({
        value: '5',
        sync: 'queued',
    })
    expect(view().summary.unsent).toBe(1)
    const download = await captureNextDownload()
    view().downloadUnsent()
    const { contents, filename } = await download()
    expect(filename).toBe('unsent-changes.csv')
    expect(contents.replace(/^\uFEFF/u, '')).toBe(
        `form,row,field,value,state,reason\nVisits,Visit 1,${HIDDEN_FIELD},5,queued,\n`
    )
})

test('a refused change to a field no column shows counts once among the failed', async () => {
    const memory = memorySource(visitForm())
    const { context, view } = await mount({
        ...memory.source,
        save: async (_engine, sent) =>
            sent.map(({ sourceKey, key }) => ({
                sourceKey,
                key,
                result: 'failed',
                reason: 'Too high',
            })),
    })
    const hidden = cellKey('r1', HIDDEN_FIELD)
    context().store.getState().commit(hidden, '5', 'rule')
    await expect
        .poll(() => context().store.getState().cells[hidden]?.sync)
        .toBe('failed')
    await later(200)
    expect(view().summary.failed).toBe(1)
})
