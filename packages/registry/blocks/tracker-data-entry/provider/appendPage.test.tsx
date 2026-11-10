import { cellAt } from '@/components/spreadsheet'
/// <reference types="@vitest/browser-playwright" />
import { createStore } from 'zustand/vanilla'
import { cellKey, createCellStore } from '@/components/spreadsheet'
import type { CellKey } from '@/components/spreadsheet'
import type { OutboxRecord } from '../outbox/outbox'
import { change, HIDDEN_FIELD, visit, visitForm } from './__tests__/rig'
import { appendPage, withPage } from './appendPage'
import type { TrackerEffectsState } from '../logic/effects'
import type { FormTables } from './openForm'

/** `visitForm`'s open stores, as `openForm` makes them. */
const opened = () => {
    const form = visitForm()
    const effects = createStore<TrackerEffectsState>()(() => ({
        cells: {},
        rowMessages: new Map(),
        rowNotes: new Map(),
    }))
    return {
        form,
        store: createCellStore({
            fields: form.fields,
            values: form.values,
            settings: { calendar: 'iso8601', dateFormat: 'YYYY-MM-DD' },
            enqueue: () => {},
            annotations: effects,
        }),
        effects,
        tables: createStore<FormTables>()(() => ({
            tables: form.tables,
            records: form.records,
        })),
        readOnlyRecords: new Map<string, string>(),
        reopenable: new Set<string>(),
    }
}

const queued = (key: CellKey, value: string, at: number): OutboxRecord => ({
    ...change(key, value, { at }),
    state: 'queued',
})

const PAGE = {
    ...visitForm({
        rows: ['r3', 'r4', 'r5'].map((id) => visit(id, id)),
        values: [[cellKey('r3', 'c1'), '1']],
    }),
    hasMore: false,
}

test('a change the outbox no longer holds once the page is in is not left unsent', async () => {
    const open = opened()
    const [sent, refused, waiting] = [
        queued(cellKey('r3', 'c1'), '9', 1),
        queued(cellKey('r4', 'c1'), '8', 2),
        queued(cellKey('r5', 'c1'), '7', 3),
    ]
    // Between the read and the restore the sync loop saved one change and refused another; their outcomes came
    // before their cells existed.
    const reads = [
        [sent, refused, waiting],
        [{ ...refused, state: 'failed' as const, reason: 'Too high' }, waiting],
    ]
    const held = await appendPage(open, PAGE, async () => reads.shift() ?? [])

    const cell = (key: CellKey) => cellAt(open.store.getState().cells, key)
    expect(cell(cellKey('r3', 'c1'))).toMatchObject({
        value: '9',
        base: '9',
        sync: 'saved',
    })
    expect(cell(cellKey('r4', 'c1'))).toMatchObject({
        value: '8',
        sync: 'failed',
        reason: 'Too high',
    })
    expect(cell(cellKey('r5', 'c1'))).toMatchObject({
        value: '7',
        sync: 'queued',
    })
    // What the outbox holds once the page is in, for counting what other grids could not save.
    expect(held).toHaveLength(2)
})

test('a newer change typed in the cell before the outbox is read again keeps it unsent', async () => {
    const open = opened()
    const key = cellKey('r3', 'c1')
    const reads = [
        () => [queued(key, '9', 1)],
        () => {
            // The person types in the restored cell; the outbox now holds that change instead.
            open.store.getState().commit(key, '10')
            return [queued(key, '10', 5)]
        },
    ]
    await appendPage(open, PAGE, async () => reads.shift()?.() ?? [])
    expect(cellAt(open.store.getState().cells, key)).toMatchObject({
        value: '10',
        // What the page loaded for the cell.
        base: '1',
        sync: 'queued',
    })
})

test('a page whose second read of the outbox fails keeps its cells as restored', async () => {
    const open = opened()
    const key = cellKey('r3', 'c1')
    const reads = [
        async () => [queued(key, '9', 1)],
        async () => {
            throw new Error('The outbox is closed')
        },
    ]
    const held = await appendPage(open, PAGE, () =>
        (reads.shift() ?? (async () => []))()
    )
    expect(held).toHaveLength(1)
    expect(open.tables.getState().tables[0].rows).toHaveLength(5)
    expect(cellAt(open.store.getState().cells, key)).toMatchObject({
        value: '9',
        sync: 'queued',
    })
})

test('the outbox is read once when the page restores nothing waiting to be sent', async () => {
    let reads = 0
    await appendPage(opened(), PAGE, async () => {
        reads += 1
        return []
    })
    expect(reads).toBe(1)
})

test('a page puts back the unsent value a rule gave its rows’ field no column shows', async () => {
    const open = opened()
    const hidden = cellKey('r3', HIDDEN_FIELD)
    await appendPage(open, PAGE, async () => [queued(hidden, '5', 1)])
    expect(cellAt(open.store.getState().cells, hidden)).toMatchObject({
        value: '5',
        sync: 'queued',
    })
})

test('a page naming a record the form holds restores its changes once', async () => {
    const open = opened()
    const person = {
        kind: 'trackedEntity',
        id: 'pA',
        trackedEntityTypeId: 'tet',
        orgUnitId: 'o1',
    } as const
    const name = cellKey('pA', 'name')
    // The form holds the person, whose name no column shows, and has put back its unsent change.
    open.form = {
        ...open.form,
        records: new Map([...open.form.records, ['pA', person]]),
        fieldsByForm: new Map([
            ...open.form.fieldsByForm,
            ['tet', new Set(['name'])],
        ]),
    }
    open.tables.setState({ records: open.form.records })
    const restore = vi.spyOn(open.store.getState(), 'restore')
    open.store.getState().restore([{ ...queued(name, '5', 1), sync: 'queued' }])

    // The page's new row names the person again, with the value DHIS2 has.
    const page = {
        ...visitForm({
            rows: [visit('r3', 'r3')],
            values: [[name, '4']],
        }),
        hasMore: false,
    }
    page.tables[0].rows[0].slots = { person: 'pA' }
    page.records = new Map([...page.records, ['pA', person]])
    await appendPage(open, page, async () => [queued(name, '5', 1)])

    const restoredNames = restore.mock.calls
        .flatMap(([cells]) => cells)
        .filter(({ key }) => key === name)
    expect(restoredNames).toHaveLength(1)
    expect(withPage(open.form, page).values.get(name)).toBeUndefined()
})
