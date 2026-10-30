/// <reference types="@vitest/browser-playwright" />
import { createStore } from 'zustand/vanilla'
import { cellKey } from '../model/types'
import type { CellKey, GridRow, GridTable } from '../model/types'
import type { OutboxRecord } from '../outbox/outbox'
import { createDataEntryStore } from '../store/store'
import { change, visit, visitForm } from './__tests__/rig'
import { appendPage } from './appendPage'
import type { EffectsState } from './context'

/** `visitForm`'s open stores, as `openForm` makes them. */
const opened = () => {
    const form = visitForm()
    return {
        form,
        store: createDataEntryStore({
            tables: form.tables,
            values: form.values,
            settings: { calendar: 'iso8601', dateFormat: 'YYYY-MM-DD' },
            enqueue: () => {},
        }),
        effects: createStore<EffectsState>()(() => ({
            cells: {},
            rowMessages: new Map(),
            rowNotes: new Map(),
        })),
        tables: createStore<{ tables: ReadonlyArray<GridTable> }>()(() => ({
            tables: form.tables,
        })),
        rows: new Map(
            form.tables[0].rows.map((row): [string, GridRow] => [row.id, row])
        ),
        readOnlyRows: new Map<string, string>(),
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

    const cell = (key: CellKey) => open.store.getState().cells[key]
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
    expect(open.store.getState().cells[key]).toMatchObject({
        value: '10',
        base: undefined,
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
    expect(open.store.getState().cells[key]).toMatchObject({
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
