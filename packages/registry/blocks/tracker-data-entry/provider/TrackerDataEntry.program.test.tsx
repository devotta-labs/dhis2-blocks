/// <reference types="@vitest/browser-playwright" />
import { captureNextDownload } from '../../../test/download.test-utils'
import { setBrowserOffline } from '../../../test/network-status.test-utils'
import type { CustomDataProvider } from '@dhis2/app-runtime'
import type { ComponentProps } from 'react'
import { onTestFinished } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { z } from 'zod'
import { cellKey } from '@/components/spreadsheet'
import { outboxName } from '../outbox/outbox'
import inpatientEvents from '../sources/test/fixtures/inpatient-events.json'
import inpatientProgram from '../sources/test/fixtures/inpatient-program.json'
import meAdmin from '../sources/test/fixtures/me-admin.json'
import { eventSource } from '../sources/eventSource'
import { TrackerDataEntrySummary } from '../summary/TrackerDataEntrySummary'
import {
    change,
    cleanUp,
    freshServer,
    KEY,
    later,
    leaving,
    memorySource,
    mount,
    records,
    USER,
    visitForm,
    withOutbox,
} from './test/rig'
import { liveRegion } from '../../../test/liveRegion'

afterEach(cleanUp)

const INPATIENT = 'eBAyeGv0exc'
const INPATIENT_STAGE = 'Zj7UnCAulEk'
const NGELEHUN = 'DiszpKrYNg8'
const BO = 'O6uvpzGd5pu'
const A = 'NGxc7JpmqqD'
const AGE = 'qrur9Dvnyt5'
const AGE_OF_A = cellKey(A, AGE)
const TODAY = '2026-10-26'
const DISCARD = 'Discard changes that could not be saved'

const json = <T,>(body: T) => z.json().parse(JSON.parse(JSON.stringify(body)))

const inpatientServer = () => {
    const imports: Array<{ events: Array<{ event: string }> }> = []
    const data = {
        me: async () => ({ id: USER, authorities: meAdmin.authorities }),
        programs: async () => json(inpatientProgram),
        'tracker/events': async (_type, query) => {
            const ids = query.params?.events
            return json({
                events: inpatientEvents.events.filter(({ event, orgUnit }) =>
                    ids === undefined
                        ? orgUnit === query.params?.orgUnit
                        : String(ids).split(',').includes(event)
                ),
            })
        },
        tracker: async (_type, query) => {
            imports.push(query.data)
            return { status: 'OK', validationReport: { errorReports: [] } }
        },
        programRules: { programRules: [] },
    } satisfies ComponentProps<typeof CustomDataProvider>['data']
    return { data, imports }
}

test('a change made in one grid of a program is sent by another grid of it', async () => {
    const dhis2 = inpatientServer()
    const server = freshServer()
    await setBrowserOffline(true)
    const ngelehun = await mount(
        eventSource({
            programId: INPATIENT,
            orgUnitId: NGELEHUN,
            today: TODAY,
        }),
        { server, data: dhis2.data, children: null }
    )
    ngelehun.context().store.getState().commit(AGE_OF_A, '6')
    await expect.poll(() => records(server)).toHaveLength(1)
    await ngelehun.screen.unmount()

    await setBrowserOffline(false)
    const bo = await mount(
        eventSource({ programId: INPATIENT, orgUnitId: BO, today: TODAY }),
        { server, data: dhis2.data, children: null }
    )
    expect(bo.context().tables[0].rows).toEqual([])
    await expect.poll(() => records(server)).toEqual([])
    expect(dhis2.imports).toMatchObject([
        {
            events: [
                {
                    event: A,
                    dataValues: [{ dataElement: AGE, value: '6' }],
                },
            ],
        },
    ])
    expect(bo.context().store.getState().cells[AGE_OF_A]).toBeUndefined()
})

test('one cell typed in two grids of a program is one record, holding the newer value', async () => {
    await setBrowserOffline(true)
    const { data } = inpatientServer()
    const server = freshServer()
    const all = await mount(
        eventSource({
            programId: INPATIENT,
            orgUnitId: NGELEHUN,
            today: TODAY,
        }),
        { server, data, children: null }
    )
    const stage = await mount(
        eventSource({
            programId: INPATIENT,
            programStageId: INPATIENT_STAGE,
            orgUnitId: NGELEHUN,
            today: TODAY,
        }),
        { server, data, children: null }
    )
    all.context().store.getState().commit(AGE_OF_A, '6')
    await expect.poll(() => records(server)).toMatchObject([{ value: '6' }])
    stage.context().store.getState().commit(AGE_OF_A, '7')
    await expect
        .poll(() => records(server))
        .toMatchObject([{ key: AGE_OF_A, value: '7' }])
})

test('a restore puts back only this form’s cells; the program’s other changes stay in the outbox and are sent', async () => {
    const server = freshServer()
    const elsewhere = [
        change('x1.c1', '9', { at: 1 }),
        change('n2.c1', '4', {
            at: 2,
            record: {
                kind: 'event',
                id: 'n2',
                programStageId: 's1',
                orgUnitId: 'o2',
                status: 'ACTIVE',
                isNew: true,
            },
        }),
        change('r1.c9', '3', { at: 3 }),
    ]
    await withOutbox(server, (outbox) =>
        outbox.putMany([...elsewhere, change('r1.c1', '7', { at: 4 })])
    )
    const memory = memorySource(visitForm())
    memory.hold()
    const { context, view } = await mount(memory.source, { server })
    expect(context().tables[0].rows.map(({ id }) => id)).toEqual(['r1', 'r2'])
    expect(Object.keys(context().store.getState().cells)).toEqual(['r1.c1'])
    expect(view().summary.unsent).toBe(1)
    await memory.saveCount(1)
    expect(memory.sent).toHaveLength(1)
    expect(memory.sent[0].map(({ key }) => key)).toEqual([
        'x1.c1',
        'n2.c1',
        'r1.c9',
        'r1.c1',
    ])
    expect(await records(server)).toHaveLength(4)

    memory.release()
    await expect.poll(() => records(server)).toEqual([])
})

test('“All changes saved” is said only once nothing of the program is left on the device', async () => {
    const server = freshServer()
    await withOutbox(server, async (outbox) => {
        await outbox.put(change('x1.c1', '9'))
        await outbox.mark(
            [{ sourceKey: KEY, key: 'x1.c1' }],
            'failed',
            'Too high'
        )
    })
    const memory = memorySource(visitForm())
    const { context } = await mount(memory.source, { server })
    const region = liveRegion()
    const said: string[] = []
    new MutationObserver(() => said.push(region.textContent ?? '')).observe(
        region,
        { childList: true, characterData: true, subtree: true }
    )
    context().store.getState().commit(cellKey('r1', 'c1'), '5')
    await expect
        .poll(() => context().store.getState().cells['r1.c1']?.sync)
        .toBe('saved')
    await later(1000)
    expect(said.filter(Boolean)).toEqual(['Values not saved: 1'])
})

test('a change another grid could not save is counted, downloaded and discarded here too', async () => {
    const server = freshServer()
    await withOutbox(server, async (outbox) => {
        await outbox.putMany([
            change('x1.c1', '9', { at: 1 }),
            change('r1.c1', '5', { at: 2 }),
        ])
        await outbox.mark(
            [{ sourceKey: KEY, key: 'x1.c1' }],
            'failed',
            'Too high'
        )
    })
    const memory = memorySource(visitForm())
    memory.hold()
    const { view } = await mount(memory.source, {
        server,
        children: <TrackerDataEntrySummary />,
    })
    expect(view().summary).toMatchObject({ unsent: 1, failed: 1 })
    expect(leaving()).toBe(true)

    const download = await captureNextDownload()
    view().downloadUnsent()
    const { contents, filename } = await download()
    expect(filename).toBe('unsent-changes.csv')
    expect(contents.replace(/^\uFEFF/u, '')).toBe(
        'form,row,field,value,state,reason\n' +
            'Visits,Visit 1,Children,5,queued,\n' +
            ',x1,Children,9,failed,Too high\n'
    )

    await userEvent.click(page.getByRole('button', { name: DISCARD }))
    const dialog = page.getByRole('alertdialog', { name: 'Discard 1 changes?' })
    await userEvent.click(dialog.getByRole('button', { name: 'Discard' }))
    await expect
        .poll(() => records(server))
        .toMatchObject([{ key: 'r1.c1', state: 'queued' }])
    await expect.poll(() => view().summary.failed).toBe(0)
    memory.release()
    await expect.poll(leaving).toBe(false)
})

test('a change of another grid refused while this one is open is counted here at once', async () => {
    const server = freshServer()
    await withOutbox(server, (outbox) => outbox.put(change('x1.c1', '9')))
    const { source } = memorySource(visitForm())
    const { view } = await mount(
        {
            ...source,
            save: async (_engine, sent) =>
                sent.map(({ sourceKey, key }) => ({
                    sourceKey,
                    key,
                    result: 'failed',
                    reason: 'Too high',
                })),
        },
        { server }
    )
    await expect.poll(() => view().summary.failed).toBe(1)
    expect(await records(server)).toMatchObject([
        { key: 'x1.c1', state: 'failed' },
    ])
})

const holdOutboxTransaction = async (server: string) => {
    const connection = Promise.withResolvers<IDBDatabase>()
    const opening = indexedDB.open(outboxName(server, USER), 1)
    opening.onsuccess = () => connection.resolve(opening.result)
    opening.onerror = () => connection.reject(opening.error)
    const database = await connection.promise
    const write = database.transaction('changes', 'readwrite')
    const store = write.objectStore('changes')
    const started = Promise.withResolvers<void>()
    let released = false
    const release = () => {
        released = true
        database.close()
    }
    onTestFinished(release)
    const keepOpen = () => {
        started.resolve()
        if (!released) {
            store.count().onsuccess = keepOpen
        }
    }
    store.count().onsuccess = keepOpen
    await started.promise
    return release
}

const putRefusal = (server: string) =>
    withOutbox(server, async (outbox) => {
        await outbox.put(change('x1.c1', '9'))
        await outbox.mark(
            [{ sourceKey: KEY, key: 'x1.c1' }],
            'failed',
            'Too high'
        )
    })

const announceRefusal = (server: string) => {
    const tab = new BroadcastChannel(outboxName(server, USER))
    tab.postMessage({
        outcomes: [
            {
                sourceKey: KEY,
                key: 'x1.c1',
                result: 'failed',
                reason: 'Too high',
                value: '9',
                at: 1,
            },
        ],
    })
    tab.close()
}

test('another tab’s refusal of a change this form does not show is counted once and not shown', async () => {
    const server = freshServer()
    const { context, view } = await mount(memorySource(visitForm()).source, {
        server,
        children: null,
    })
    await putRefusal(server)
    announceRefusal(server)
    await expect.poll(() => view().summary.failed).toBe(1)
    await later(100)
    expect(view().summary.failed).toBe(1)
    expect(context().store.getState().cells['x1.c1']).toBeUndefined()
})

test('a form closed while it counts the other grids’ failed changes leaves the summary as it was', async () => {
    const server = freshServer()
    const { screen, view } = await mount(memorySource(visitForm()).source, {
        server,
        children: null,
    })
    await putRefusal(server)
    const release = await holdOutboxTransaction(server)
    const reads = vi.spyOn(IDBObjectStore.prototype, 'getAll')
    const message = Promise.withResolvers<void>()
    const listener = new BroadcastChannel(outboxName(server, USER))
    listener.onmessage = () => {
        listener.close()
        message.resolve()
    }
    onTestFinished(() => listener.close())
    try {
        announceRefusal(server)
        await message.promise
        const read = reads.mock.results.at(-1)
        expect(read?.type).toBe('return')
        if (read?.type !== 'return') {
            throw new Error('Expected the form to queue a real IndexedDB read')
        }
        expect(read.value.readyState).toBe('pending')
        const finished = Promise.withResolvers<void>()
        read.value.transaction?.addEventListener(
            'complete',
            () => finished.resolve(),
            { once: true }
        )
        await screen.unmount()
        const summary = view().summary
        release()
        await finished.promise
        expect(view().summary).toBe(summary)
    } finally {
        reads.mockRestore()
        release()
    }
})
