/// <reference types="@vitest/browser-playwright" />
import type { CustomDataProvider } from '@dhis2/app-runtime'
import type { ComponentProps } from 'react'
import { page, userEvent } from 'vitest/browser'
import { z } from 'zod'
import { cellKey } from '../model/types'
import { outboxName } from '../outbox/outbox'
import inpatientEvents from '../sources/__tests__/fixtures/inpatient-events.json'
import inpatientProgram from '../sources/__tests__/fixtures/inpatient-program.json'
import meAdmin from '../sources/__tests__/fixtures/me-admin.json'
import { eventSource } from '../sources/eventSource'
import { DataEntrySummary } from '../summary/DataEntrySummary'
import {
    catchDownloads,
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
} from './__tests__/rig'

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

/** What the server sends: plain JSON, no `undefined` members. */
const json = <T,>(body: T) => z.json().parse(JSON.parse(JSON.stringify(body)))

/** DHIS2 holding the inpatient events at Ngelehun; every import is kept and saved. */
const inpatientServer = () => {
    const imports: Array<{ events: Array<{ event: string }> }> = []
    const data = {
        me: async () => ({ id: USER, authorities: meAdmin.authorities }),
        programs: async () => json(inpatientProgram),
        // A load names an org unit; the read before an import names events.
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
    const online = vi.spyOn(Navigator.prototype, 'onLine', 'get')
    online.mockReturnValue(false)
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

    // Bo holds none of Ngelehun's events.
    online.mockReturnValue(true)
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
    vi.spyOn(Navigator.prototype, 'onLine', 'get').mockReturnValue(false)
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
        // An event another grid shows, a new row another grid adds, and a field this form has no column for.
        change('x1.c1', '9', { at: 1 }),
        change('n2.c1', '4', {
            at: 2,
            row: { programStageId: 's1', orgUnitId: 'o2', isNew: true },
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
    await expect.poll(() => memory.sent).toHaveLength(1)
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
    const region = page.getByRole('status').element()
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
    // The other grid's change is still on the device, not saved.
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
        children: <DataEntrySummary />,
    })
    expect(view().summary).toMatchObject({ unsent: 1, failed: 1 })
    expect(leaving()).toBe(true)

    // This form's change by its labels; the other grid's by the names known here, else by its ids.
    const files = catchDownloads()
    view().downloadUnsent()
    await expect.poll(() => files).toHaveLength(1)
    expect(await files[0].text()).toBe(
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

/** Holds the outbox's reads from now on: each answers only once `release` is called. */
const holdReads = () => {
    const held: Array<() => void> = []
    const getAll = IDBObjectStore.prototype.getAll
    vi.spyOn(IDBObjectStore.prototype, 'getAll').mockImplementation(function (
        this: IDBObjectStore,
        ...args: Parameters<IDBObjectStore['getAll']>
    ) {
        const read = getAll.apply(this, args)
        // Listens before the outbox does, so the outbox hears of the answer only on release.
        read.addEventListener('success', (event) => {
            event.stopImmediatePropagation()
            held.push(() => read.onsuccess?.(event))
        })
        return read
    })
    return {
        held: () => held.length,
        release: () => held.splice(0).forEach((answer) => answer()),
    }
}

/** Another tab of the program refuses a change to a row this form does not show, and says so. */
const refusedThere = async (server: string) => {
    await withOutbox(server, async (outbox) => {
        await outbox.put(change('x1.c1', '9'))
        await outbox.mark(
            [{ sourceKey: KEY, key: 'x1.c1' }],
            'failed',
            'Too high'
        )
    })
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
    await refusedThere(server)
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
    await later(100)
    const reads = holdReads()
    await refusedThere(server)
    await expect.poll(reads.held).toBe(1)
    await screen.unmount()
    const summary = view().summary
    reads.release()
    await later(100)
    expect(view().summary).toBe(summary)
})
