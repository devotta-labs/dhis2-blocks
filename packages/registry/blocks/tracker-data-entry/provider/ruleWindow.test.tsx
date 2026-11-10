/// <reference types="@vitest/browser-playwright" />
import { createStore } from 'zustand/vanilla'
import type { StoreApi } from 'zustand/vanilla'
import { emptyEffects } from '@/components/program-rules'
import type { EventsRules } from '@/components/program-rules'
import { cellKey, createCellStore } from '@/components/spreadsheet'
import type {
    CellKey,
    CellStoreState,
    DrawnRows,
} from '@/components/spreadsheet'
import { holdIdle, visit, visitForm } from './__tests__/rig'
import { connectRules } from './connectRules'
import type { TrackerEffectsState } from '../logic/effects'
import type { FormTables } from './openForm'
import { formEffects } from './formRows'

// Rules run for the rows the grid draws and the rows people change; the grid here is a store the test writes.

afterEach(() => vi.restoreAllMocks())

const by = {
    ruleId: 'rule',
    ruleName: 'Stand-in rule',
    actionId: 'action',
    condition: 'true',
    readsFields: [],
}

const FIVE_ROWS = ['r1', 'r2', 'r3', 'r4', 'r5'].map((id) => visit(id, id))
const SIX_ROWS = [...FIVE_ROWS, visit('r6', 'r6')]

/** Keeps the page busy, as slow rules do. */
const busy = (ms: number) => {
    const end = performance.now() + ms
    while (performance.now() < end) {
        // the rules are thinking
    }
}

/** `visitForm`'s five rows, of which the grid draws `drawnRows`, wired to rules that hide `c2` in every row. */
const connect = (
    drawnRows: ReadonlyArray<string>,
    {
        before,
        slow = false,
    }: {
        /** Runs on the store before the rules connect, as changes restored from the outbox do. */
        before?(store: StoreApi<CellStoreState>): void
        /** Each row's rules take 60 ms. */
        slow?: boolean
    } = {}
) => {
    const form = visitForm({ rows: FIVE_ROWS })
    const settings = { calendar: 'iso8601', dateFormat: 'YYYY-MM-DD' } as const
    const effects = createStore<TrackerEffectsState>()(() => ({
        cells: formEffects(
            form,
            form.readOnlyRecords,
            form.tables,
            form.records
        ),
        rowMessages: new Map(),
        rowNotes: new Map(),
    }))
    const open = {
        store: createCellStore({
            fields: form.fields,
            values: form.values,
            settings,
            enqueue: () => {},
            annotations: effects,
        }),
        effects,
        tables: createStore<FormTables>()(() => ({
            tables: form.tables,
            records: form.records,
        })),
        readOnlyRecords: form.readOnlyRecords,
        beforeComplete: new Set<(rowId: string) => string | undefined>(),
    }
    before?.(open.store)
    const tableId = form.tables[0].id
    const drawn = createStore<DrawnRows>()(() => ({
        rows: new Map([[tableId, drawnRows]]),
    }))
    const ran: string[] = []
    const rules: EventsRules = {
        evaluate(_rows, rowIds) {
            const all = new Map(
                rowIds.map((rowId) => {
                    ran.push(rowId)
                    if (slow) {
                        busy(60)
                    }
                    const hidden = emptyEffects()
                    hidden.hiddenFields.set('c2', [by])
                    return [rowId, hidden]
                })
            )
            return { effects: all, failures: new Map() }
        },
        rowsAffectedBy: (_rows, rowId) => [rowId],
        invalidRules: [],
        optionGroupOptions: new Map(),
    }
    const session = {
        cleared: new Map<CellKey, string>(),
        touched: new Set<string>(),
        ruleNotes: new Map<string, ReadonlyArray<string>>(),
        seen: new Set<string>(),
    }
    // As the provider does when the rules change: the same stores and session.
    const reconnect = () =>
        connectRules({
            open,
            form,
            rules,
            settings,
            announce: () => {},
            ...session,
            idScope: 'data-entry',
            drawn,
        })
    const stop = reconnect()
    return {
        ...open,
        ran,
        stop,
        reconnect,
        /** The grid draws these rows from now on. */
        draw: (rowIds: ReadonlyArray<string>) =>
            drawn.setState({ rows: new Map([[tableId, rowIds]]) }),
        /** The grid is gone. */
        undraw: () => drawn.setState({ rows: new Map() }),
        hidden: (rowId: string) =>
            effects.getState().cells[cellKey(rowId, 'c2')]?.hiddenBy !==
            undefined,
    }
}

test('rules run for the rows the grid draws; another row’s run once the grid draws it, when idle', () => {
    const idle = holdIdle()
    const { ran, hidden, draw, stop } = connect(['r1', 'r2'])
    idle.run()
    expect(ran).toEqual(['r1', 'r2'])
    expect(hidden('r2')).toBe(true)
    expect(hidden('r3')).toBe(false)

    draw(['r2', 'r3', 'r4'])
    // Not in the task that drew them: scrolling is not held up.
    expect(ran).toEqual(['r1', 'r2'])
    idle.run()
    expect(ran).toEqual(['r1', 'r2', 'r3', 'r4'])
    expect(hidden('r4')).toBe(true)

    // A row drawn again does not run again.
    draw(['r1', 'r2'])
    draw(['r3', 'r4'])
    idle.run()
    expect(ran).toEqual(['r1', 'r2', 'r3', 'r4'])
    expect(hidden('r5')).toBe(false)
    stop()
})

test('a row scrolled away before its turn waits until the grid draws it again', () => {
    const idle = holdIdle()
    const { ran, draw, stop } = connect(['r1', 'r2', 'r3', 'r4'], {
        slow: true,
    })
    // The first slice, about 100 ms, reached two rows.
    expect(ran).toEqual(['r1', 'r2'])
    draw(['r4', 'r5'])
    idle.run()
    expect(ran).toEqual(['r1', 'r2', 'r4', 'r5'])
    draw(['r3'])
    idle.run()
    expect(ran).toEqual(['r1', 'r2', 'r4', 'r5', 'r3'])
    stop()
})

test('a row changed before the grid opened runs without being drawn: its rules’ values are saved with it', () => {
    const idle = holdIdle()
    const { ran, stop } = connect(['r1'], {
        before: (opened) =>
            opened.getState().commit(cellKey('r4', 'c3'), 'changed'),
    })
    idle.run()
    expect(ran).toEqual(['r1', 'r4'])
    stop()
})

test('a change runs its row’s rules, drawn or not', async () => {
    const idle = holdIdle()
    const { ran, store, hidden, stop } = connect(['r1'])
    idle.run()
    store.getState().commit(cellKey('r5', 'c3'), 'changed')
    await expect.poll(() => ran).toEqual(['r1', 'r5'])
    expect(hidden('r5')).toBe(true)
    stop()
})

test('completing a row the grid never drew runs its rules first', () => {
    const idle = holdIdle()
    const { ran, beforeComplete, hidden, stop } = connect(['r1'])
    idle.run()
    expect(hidden('r5')).toBe(false)
    expect([...beforeComplete].map((prepare) => prepare('r5'))).toEqual([
        undefined,
    ])
    expect(ran).toEqual(['r1', 'r5'])
    expect(hidden('r5')).toBe(true)
    stop()
})

test('a row added runs before the next paint once the grid draws it; one it does not draw waits', async () => {
    const idle = holdIdle()
    const { ran, tables, draw, stop } = connect(['r1', 'r5'])
    idle.run()
    expect(ran).toEqual(['r1', 'r5'])

    const more = visitForm({ rows: SIX_ROWS })
    // The records there keep their identity: only r6 is new.
    tables.setState(({ records }) => ({
        tables: more.tables,
        records: new Map([...more.records, ...records]),
    }))
    await Promise.resolve()
    expect(ran).toEqual(['r1', 'r5'])
    draw(['r1', 'r5', 'r6'])
    // No idle time, no paint: a microtask.
    await Promise.resolve()
    expect(ran).toEqual(['r1', 'r5', 'r6'])
    stop()
})

test('while no grid draws the form, every row runs', () => {
    const idle = holdIdle()
    const { ran, undraw, stop, reconnect } = connect(['r1'])
    idle.run()
    expect(ran).toEqual(['r1'])
    // A table's rows waiting for a grid keep waiting when it goes, as when it draws its table anew.
    undraw()
    idle.run()
    expect(ran).toEqual(['r1'])
    stop()
    const again = reconnect()
    idle.run()
    expect(ran).toEqual(['r1', 'r2', 'r3', 'r4', 'r5', 'r1'])
    again()
})
