/// <reference types="@vitest/browser-playwright" />
import { createStore } from 'zustand/vanilla'
import type { StoreApi } from 'zustand/vanilla'
import { emptyEffects } from '@/components/program-rules'
import type { EventsRules, RuleEffects } from '@/components/program-rules'
import {
    cellKey,
    createCellStore,
    rowHeaderDomId,
} from '@/components/spreadsheet'
import type { CellKey, CellStoreState } from '@/components/spreadsheet'
import { HIDDEN_FIELD, later, visit, visitForm } from './test/rig'
import { connectRules } from './connectRules'
import type { TrackerEffectsState } from '../logic/effects'
import type { FormTables } from './openForm'
import { formEffects } from './formRows'

afterEach(() => vi.restoreAllMocks())
beforeEach(() => performance.clearMeasures('data-entry:rules'))

const by = {
    ruleId: 'rule',
    ruleName: 'Stand-in rule',
    actionId: 'action',
    condition: 'true',
    readsFields: [],
}

const standIn: (
    effectsOf: (rowId: string) => RuleEffects | Error | undefined,
    affected?: (rowId: string) => string[]
) => EventsRules = (effectsOf, affected = (rowId) => [rowId]) => ({
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

const busy = (ms: number) => {
    const end = performance.now() + ms
    while (performance.now() < end) {}
}

const FIVE_ROWS = ['r1', 'r2', 'r3', 'r4', 'r5'].map((id) => visit(id, id))

const connect = (
    rules: EventsRules,
    {
        before,
        ...options
    }: Parameters<typeof visitForm>[0] & {
        before?(store: StoreApi<CellStoreState>): void
    } = {}
) => {
    const form = visitForm(options)
    const settings = { calendar: 'iso8601', dateFormat: 'YYYY-MM-DD' } as const
    const queued: CellKey[] = []
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
            enqueue: (key) => queued.push(key),
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
    const said: string[] = []
    const session = {
        cleared: new Map<CellKey, string>(),
        touched: new Set<string>(),
        ruleNotes: new Map<string, ReadonlyArray<string>>(),
        seen: new Set<string>(),
    }
    const reconnect = (next: EventsRules) =>
        connectRules({
            open,
            form,
            rules: next,
            settings,
            announce: (text) => said.push(text),
            ...session,
            idScope: 'data-entry',
        })
    const stop = reconnect(rules)
    return { ...open, queued, said, stop, reconnect }
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
            { tone: 'error', text: 'The engine stopped', source: 'rule' },
        ])
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
        readOnlyRecords: [['r2', 'Locked']],
    })
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
    store.getState().commit(cellKey('r1', 'c3'), 'again')
    await later(50)
    expect(queued).toEqual([
        cellKey('r1', 'c3'),
        cellKey('r1', 'c1'),
        cellKey('r1', 'c3'),
    ])
    stop()
})

test('a value a rule assigns to a field with no column is saved with the row', async () => {
    const assigning = () => {
        const effects = emptyEffects()
        effects.assignedValues.set(HIDDEN_FIELD, { value: '5', by })
        return effects
    }
    const { store, queued, stop } = connect(standIn(assigning))
    const hidden = cellKey('r1', HIDDEN_FIELD)
    expect(queued).toEqual([])
    store.getState().commit(cellKey('r1', 'c2'), 'A')
    await expect.poll(() => queued).toContain(hidden)
    expect(store.getState().cells[hidden]).toMatchObject({
        value: '5',
        source: 'rule',
    })
    expect(store.getState().cells[cellKey('r2', HIDDEN_FIELD)]).toBeUndefined()
    stop()
})

test('no rule value is committed in a read-only record, shown or not', async () => {
    const assigning = () => {
        const effects = emptyEffects()
        effects.assignedValues.set(HIDDEN_FIELD, { value: '5', by })
        effects.assignedValues.set('c1', { value: '7', by })
        return effects
    }
    const { store, queued, stop } = connect(standIn(assigning), {
        readOnlyRecords: [['r2', 'Locked']],
    })
    store.getState().restore([
        {
            key: cellKey('r2', 'c2'),
            value: 'A',
            base: null,
            sync: 'queued',
        },
    ])
    store.getState().commit(cellKey('r1', 'c2'), 'A')
    await expect.poll(() => queued).toContain(cellKey('r1', HIDDEN_FIELD))
    await later(50)
    expect(queued.filter((key) => key.startsWith('r2.'))).toEqual([])
    expect(store.getState().cells[cellKey('r2', HIDDEN_FIELD)]).toBeUndefined()
    expect(store.getState().cells[cellKey('r2', 'c1')]).toBeUndefined()
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
    expect(said).toEqual([])
    expect(store.getState().cells[r1]?.value).toBe('A')

    store.getState().commit(cellKey('r1', 'c1'), '4')
    await expect.poll(() => said).toEqual([note])
    expect(store.getState().cells[r1]).toMatchObject({
        value: undefined,
        source: 'rule',
    })
    expect(effects.getState().cells[r1]?.messages).toEqual([
        { tone: 'warning', text: note, source: 'rule' },
    ])
    expect(store.getState().cells[cellKey('r2', 'c2')]?.value).toBe('A')

    hide = false
    store.getState().commit(cellKey('r1', 'c1'), '5')
    await later(50)
    expect(effects.getState().cells[r1]?.messages).toEqual([
        { tone: 'warning', text: note, source: 'rule' },
    ])
    store.getState().commit(r1, 'Bravo')
    await expect.poll(() => effects.getState().cells[r1]).toBeUndefined()
    store.getState().commit(r1, '')
    await later(50)
    expect(effects.getState().cells[r1]).toBeUndefined()
    stop()
})

const atIdle = () =>
    new Promise<void>((resolve) => requestIdleCallback(() => resolve()))

test('loading runs rules for about 100 ms at once, then about 16 ms at a time when idle, a row at least', async () => {
    const rows = FIVE_ROWS
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
    await atIdle()
    expect(done()).toBe(3)
    await atIdle()
    await atIdle()
    expect(done()).toBe(5)
    stop()
})

test('a rule’s change re-runs only rows already evaluated; the others wait for their turn', async () => {
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
    await atIdle()
    expect(hidden('r3')).toBeDefined()
    stop()
})

test('completing a changed row the rules have not reached yet runs its rules first', () => {
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
    const rows = FIVE_ROWS
    const tableId = visitForm({ rows }).tables[0].id
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
    expect(done()).toBe(5)
    expect(
        performance.getEntriesByName('data-entry:rules-visible', 'measure')
    ).toHaveLength(measuresBefore + 1)
    stop()
    headers.forEach((header) => header.remove())
})

test('a reconnection runs the rows in view, then the rest; in each, the rows not evaluated yet before the rows seen', async () => {
    const tableId = visitForm({ rows: FIVE_ROWS }).tables[0].id
    const headers = ['r1', 'r4'].map((id) => {
        const header = document.createElement('div')
        header.id = rowHeaderDomId('data-entry', tableId, id)
        header.textContent = id
        document.body.append(header)
        return header
    })
    const { stop, reconnect } = connect(
        standIn((rowId) =>
            rowId === 'r4' || rowId === 'r5' ? undefined : hiding('c2')
        ),
        { rows: FIVE_ROWS }
    )
    await atIdle()
    stop()

    const ran: string[] = []
    const again = reconnect(
        standIn((rowId) => {
            ran.push(rowId)
            busy(60)
            return hiding('c2')
        })
    )
    expect(ran).toEqual(['r4', 'r1'])
    await atIdle()
    await atIdle()
    await atIdle()
    expect(ran).toEqual(['r4', 'r1', 'r5', 'r2', 'r3'])
    again()
    headers.forEach((header) => header.remove())
})

test('completing a changed row still waiting to run again after a reconnection runs the new rules first', async () => {
    const { effects, beforeComplete, stop, reconnect } = connect(
        standIn(() => hiding('c2')),
        {
            rows: FIVE_ROWS,
            before: (opened) =>
                opened.getState().commit(cellKey('r4', 'c3'), 'changed'),
        }
    )
    await atIdle()
    stop()
    const again = reconnect(
        standIn((rowId) => {
            busy(60)
            return rowId === 'r4'
                ? new Error('A new rule failed')
                : hiding('c2')
        })
    )
    const failure = () => effects.getState().rowMessages.get('r4')?.[0]?.text
    expect(failure()).toBeUndefined()
    expect([...beforeComplete].map((prepare) => prepare('r4'))).toEqual([
        undefined,
    ])
    expect(failure()).toBe('A new rule failed')
    again()
})
