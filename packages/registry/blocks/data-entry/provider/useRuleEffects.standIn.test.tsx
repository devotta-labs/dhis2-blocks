/// <reference types="@vitest/browser-playwright" />
import { createStore } from 'zustand/vanilla'
import type { StoreApi } from 'zustand/vanilla'
import { emptyEffects } from '@/components/program-rules'
import type { EventsRules, RuleEffects } from '@/components/program-rules'
import { cellKey } from '../model/types'
import type { CellKey, GridTable } from '../model/types'
import { createDataEntryStore } from '../store/store'
import type { DataEntryState } from '../store/store'
import { rowHeaderDomId } from '../grid/headers'
import { holdIdle, later, visit, visitForm } from './__tests__/rig'
import { connectRules } from './connectRules'
import type { EffectsState } from './context'
import { formEffects } from './formRows'

// Stand-in rules, to reach what the RMNCH rules never do: failures, slow rules, values the stand-in chooses.

afterEach(() => vi.restoreAllMocks())
beforeEach(() => performance.clearMeasures('data-entry:rules'))

const by = {
    ruleId: 'rule',
    ruleName: 'Stand-in rule',
    actionId: 'action',
    condition: 'true',
    readsFields: [],
}

/** Rules that give each row what `effectsOf` says: effects, an error, or nothing (not evaluated). */
const standIn = (
    effectsOf: (rowId: string) => RuleEffects | Error | undefined,
    affected: (rowId: string) => string[] = (rowId) => [rowId]
): EventsRules => ({
    evaluate(_rows, rowIds) {
        const effects = new Map<string, RuleEffects>()
        const failures = new Map<string, Error>()
        for (const rowId of rowIds) {
            const result = effectsOf(rowId)
            if (result instanceof Error) {
                failures.set(rowId, result)
            } else if (result !== undefined) {
                effects.set(rowId, result)
            }
        }
        return { effects, failures }
    },
    rowsAffectedBy: (_rows, rowId) => affected(rowId),
    invalidRules: [],
    optionGroupOptions: new Map(),
})

const hiding = (field: string) => {
    const effects = emptyEffects()
    effects.hiddenFields.set(field, [by])
    return effects
}

/** Keeps the page busy, as slow rules do. */
const busy = (ms: number) => {
    const end = performance.now() + ms
    while (performance.now() < end) {
        // the rules are thinking
    }
}

const FIVE_ROWS = ['r1', 'r2', 'r3', 'r4', 'r5'].map((id) => visit(id, id))

/** `visitForm`'s stores, wired to the rules as the provider wires them. */
const connect = (
    rules: EventsRules,
    {
        before,
        ...options
    }: Parameters<typeof visitForm>[0] & {
        /** Runs on the store before the rules connect, as changes restored from the outbox do. */
        before?(store: StoreApi<DataEntryState>): void
    } = {}
) => {
    const form = visitForm(options)
    const settings = { calendar: 'iso8601', dateFormat: 'YYYY-MM-DD' } as const
    const queued: CellKey[] = []
    const open = {
        store: createDataEntryStore({
            tables: form.tables,
            values: form.values,
            settings,
            enqueue: (key) => queued.push(key),
        }),
        effects: createStore<EffectsState>()(() => ({
            cells: formEffects(form.required, form.readOnlyRows, form.tables),
            rowMessages: new Map(),
            rowNotes: new Map(),
        })),
        tables: createStore<{ tables: ReadonlyArray<GridTable> }>()(() => ({
            tables: form.tables,
        })),
        readOnlyRows: form.readOnlyRows,
        beforeComplete: new Set<(rowId: string) => string | undefined>(),
    }
    before?.(open.store)
    const said: string[] = []
    const stop = connectRules({
        open,
        form,
        rules,
        settings,
        announce: (text) => said.push(text),
        cleared: new Map(),
        touched: new Set(),
        idScope: 'data-entry',
    })
    return { ...open, queued, said, stop }
}

test('a row the rules fail on says why and keeps no stale effects; a row not evaluated keeps its own', async () => {
    let failing = false
    const { store, effects, stop } = connect(
        standIn(
            (rowId) => {
                if (failing) {
                    return rowId === 'r1'
                        ? new Error('The engine stopped')
                        : undefined
                }
                const effects = hiding('c2')
                effects.displayTexts.push({
                    location: 'feedback',
                    label: 'Visit note',
                    value: '',
                    by,
                })
                return effects
            },
            () => ['r1', 'r2']
        )
    )
    const r1 = cellKey('r1', 'c2')
    const r2 = cellKey('r2', 'c2')
    expect(effects.getState().cells[r1]?.hiddenBy).toBe(
        'Hidden by rule: Stand-in rule'
    )
    expect(effects.getState().rowNotes.get('r1')).toEqual(['Visit note'])
    const before = effects.getState().cells[r2]

    failing = true
    store.getState().commit(cellKey('r1', 'c1'), '4')
    await expect
        .poll(() => effects.getState().rowMessages.get('r1'))
        .toEqual([
            { kind: 'error', text: 'The engine stopped', source: 'rule' },
        ])
    // The form's own effects stay: Children is required.
    expect(effects.getState().cells[r1]).toBeUndefined()
    expect(effects.getState().cells[cellKey('r1', 'c1')]).toEqual({
        required: true,
        messages: [],
    })
    expect(effects.getState().rowNotes.has('r1')).toBe(false)
    expect(effects.getState().cells[r2]).toBe(before)
    expect(effects.getState().rowNotes.get('r2')).toEqual(['Visit note'])
    stop()
})

test('assignments are saved only in rows a person changed, into open cells of the row’s stage, when they change', async () => {
    const assigning = () => {
        const effects = emptyEffects()
        // c3 is not in stage s1; c2 already holds A.
        for (const [field, value] of [
            ['c1', '7'],
            ['c2', 'A'],
            ['c3', 'note'],
        ]) {
            effects.assignedValues.set(field, { value, by })
        }
        return effects
    }
    const { store, effects, queued, stop } = connect(standIn(assigning), {
        values: [
            [cellKey('r1', 'c2'), 'A'],
            [cellKey('r2', 'c2'), 'A'],
        ],
        readOnlyRows: [['r2', 'Locked']],
    })
    // Opening changes nothing: the cell shows its stored value, locked by the rule.
    expect(queued).toEqual([])
    expect(store.getState().cells[cellKey('r1', 'c1')]).toBeUndefined()
    expect(effects.getState().cells[cellKey('r1', 'c1')]?.readOnly).toBe(
        'Assigned by rule: Stand-in rule'
    )
    expect(effects.getState().cells[cellKey('r2', 'c1')]?.readOnly).toBe(
        'Locked'
    )

    store.getState().commit(cellKey('r1', 'c3'), 'seen')
    await expect
        .poll(() => queued)
        .toEqual([cellKey('r1', 'c3'), cellKey('r1', 'c1')])
    expect(store.getState().cells[cellKey('r1', 'c1')]).toMatchObject({
        value: '7',
        source: 'rule',
    })
    // The next pass sees the same values: nothing more is sent.
    store.getState().commit(cellKey('r1', 'c3'), 'again')
    await later(50)
    expect(queued).toEqual([
        cellKey('r1', 'c3'),
        cellKey('r1', 'c1'),
        cellKey('r1', 'c3'),
    ])
    stop()
})

test('a change touches its row only while it is on its way to DHIS2: only there do the rules save', async () => {
    const assigning = () => {
        const effects = emptyEffects()
        effects.assignedValues.set('c1', { value: '7', by })
        return effects
    }
    const { store, queued, stop } = connect(standIn(assigning), {
        rows: FIVE_ROWS,
    })
    const assigned = () => queued.filter((key) => key.endsWith('.c1')).sort()
    // A value as a page loads it, and a failed change put back, are no change on its way.
    store.getState().restore([
        { key: cellKey('r1', 'c2'), value: 'A', base: 'A', sync: 'idle' },
        {
            key: cellKey('r2', 'c2'),
            value: 'B',
            base: null,
            sync: 'failed',
            reason: 'Refused',
        },
    ])
    await later(50)
    expect(assigned()).toEqual([])
    // A change put back while it waits to be sent is; so is what a person types.
    store.getState().restore([
        {
            key: cellKey('r3', 'c2'),
            value: 'C',
            base: null,
            sync: 'queued',
        },
    ])
    store.getState().commit(cellKey('r4', 'c2'), 'A')
    await expect
        .poll(assigned)
        .toEqual([cellKey('r3', 'c1'), cellKey('r4', 'c1')])
    stop()
})

test('what a rule cleared stays on the cell until it holds a value again', async () => {
    let hide = true
    const { store, effects, said, stop } = connect(
        standIn(() => (hide ? hiding('c2') : emptyEffects())),
        {
            values: [
                [cellKey('r1', 'c2'), 'A'],
                [cellKey('r2', 'c2'), 'A'],
            ],
        }
    )
    const note = 'Cleared by rule: Stand-in rule'
    const r1 = cellKey('r1', 'c2')
    // Hidden, not cleared, until a person changes the row.
    expect(said).toEqual([])
    expect(store.getState().cells[r1]?.value).toBe('A')

    store.getState().commit(cellKey('r1', 'c1'), '4')
    await expect.poll(() => said).toEqual([note])
    expect(store.getState().cells[r1]).toMatchObject({
        value: undefined,
        source: 'rule',
    })
    expect(effects.getState().cells[r1]?.messages).toEqual([
        { kind: 'warning', text: note, source: 'rule' },
    ])
    expect(store.getState().cells[cellKey('r2', 'c2')]?.value).toBe('A')

    hide = false
    store.getState().commit(cellKey('r1', 'c1'), '5')
    await later(50)
    expect(effects.getState().cells[r1]?.messages).toEqual([
        { kind: 'warning', text: note, source: 'rule' },
    ])
    store.getState().commit(r1, 'Bravo')
    await expect.poll(() => effects.getState().cells[r1]).toBeUndefined()
    // Emptied by the person, it was not the rule.
    store.getState().commit(r1, '')
    await later(50)
    expect(effects.getState().cells[r1]).toBeUndefined()
    stop()
})

test('loading runs rules for about 100 ms at once, then about 16 ms at a time when idle, a row at least', () => {
    const idle = holdIdle()
    const rows = FIVE_ROWS
    // Each row's rules take 60 ms.
    const slow = standIn(() => {
        busy(60)
        return hiding('c2')
    })
    const { effects, stop } = connect(slow, { rows })
    const done = () =>
        rows.filter(
            ({ id }) => effects.getState().cells[cellKey(id, 'c2')]?.hiddenBy
        ).length

    expect(done()).toBe(2)
    expect(
        performance.getEntriesByName('data-entry:rules', 'measure')
    ).toHaveLength(1)
    idle.next()
    expect(done()).toBe(3)
    idle.run()
    expect(done()).toBe(5)
    stop()
})

test('a rule’s change re-runs only rows already evaluated; the others wait for their turn', () => {
    const idle = holdIdle()
    // r1, changed before the grid opened, gets a value from its rules; every row reads it.
    const slow = standIn(
        (rowId) => {
            busy(60)
            const effects = hiding('c2')
            if (rowId === 'r1') {
                effects.assignedValues.set('c1', { value: '7', by })
            }
            return effects
        },
        () => FIVE_ROWS.map(({ id }) => id)
    )
    const { store, effects, stop } = connect(slow, {
        rows: FIVE_ROWS,
        before: (opened) =>
            opened.getState().commit(cellKey('r1', 'c3'), 'changed'),
    })
    const hidden = (rowId: string) =>
        effects.getState().cells[cellKey(rowId, 'c2')]?.hiddenBy
    expect(store.getState().cells[cellKey('r1', 'c1')]?.value).toBe('7')
    expect(hidden('r2')).toBeDefined()
    expect(hidden('r3')).toBeUndefined()
    idle.next()
    expect(hidden('r3')).toBeDefined()
    stop()
})

test('completing a changed row the rules have not reached yet runs its rules first', () => {
    holdIdle()
    const slow = standIn(() => {
        busy(60)
        const effects = hiding('c2')
        effects.assignedValues.set('c1', { value: '7', by })
        return effects
    })
    const { store, effects, beforeComplete, stop } = connect(slow, {
        rows: FIVE_ROWS,
        before: (opened) =>
            opened.getState().commit(cellKey('r4', 'c3'), 'changed'),
    })
    expect(effects.getState().cells[cellKey('r4', 'c2')]).toBeUndefined()

    expect([...beforeComplete].map((prepare) => prepare('r4'))).toEqual([
        undefined,
    ])
    expect(effects.getState().cells[cellKey('r4', 'c2')]?.hiddenBy).toBe(
        'Hidden by rule: Stand-in rule'
    )
    expect(store.getState().cells[cellKey('r4', 'c1')]).toMatchObject({
        value: '7',
        source: 'rule',
    })
    stop()
})

test('an evaluated cell whose effects did not change keeps its object', async () => {
    let evaluations = 0
    const { store, effects, stop } = connect(
        standIn(() => {
            evaluations += 1
            return hiding('c2')
        })
    )
    const hidden = cellKey('r1', 'c2')
    const before = effects.getState().cells[hidden]
    const evaluated = evaluations

    store.getState().commit(cellKey('r1', 'c1'), '4')
    await expect.poll(() => evaluations).toBeGreaterThan(evaluated)
    expect(effects.getState().cells[hidden]).toBe(before)
    stop()
})

test('a rule’s value its type refuses leaves no draft in the locked cell', () => {
    const { store, effects, stop } = connect(
        standIn(() => {
            const effects = emptyEffects()
            effects.assignedValues.set('c1', { value: 'many', by })
            return effects
        }),
        {
            before: (opened) =>
                opened.getState().commit(cellKey('r1', 'c3'), 'changed'),
        }
    )
    const children = cellKey('r1', 'c1')
    expect(store.getState().cells[children]?.draft).toBeUndefined()
    expect(effects.getState().cells[children]?.readOnly).toBe(
        'Assigned by rule: Stand-in rule'
    )
    stop()
})

test('rows in view take their slices one after another, without waiting for idle time', async () => {
    const idle = holdIdle()
    const rows = FIVE_ROWS
    const tableId = visitForm({ rows }).tables[0].id
    // The row headers the grid would draw, in view.
    const headers = rows.map(({ id }) => {
        const header = document.createElement('div')
        header.id = rowHeaderDomId('data-entry', tableId, id)
        header.textContent = id
        document.body.append(header)
        return header
    })
    const slow = standIn(() => {
        busy(60)
        return hiding('c2')
    })
    const measuresBefore = performance.getEntriesByName(
        'data-entry:rules-visible',
        'measure'
    ).length
    const { effects, stop } = connect(slow, { rows })
    const done = () =>
        rows.filter(
            ({ id }) => effects.getState().cells[cellKey(id, 'c2')]?.hiddenBy
        ).length

    expect(done()).toBe(2)
    await later(400)
    // No idle callback ran: the rows in view were not left waiting for one.
    expect(done()).toBe(5)
    expect(
        performance.getEntriesByName('data-entry:rules-visible', 'measure')
    ).toHaveLength(measuresBefore + 1)
    idle.run()
    stop()
    headers.forEach((header) => header.remove())
})
