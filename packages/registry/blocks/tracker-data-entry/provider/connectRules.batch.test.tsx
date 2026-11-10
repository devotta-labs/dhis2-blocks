/// <reference types="@vitest/browser-playwright" />
import { createStore } from 'zustand/vanilla'
import { emptyEffects } from '@/components/program-rules'
import type {
    EventsRuleRow,
    EventsRules,
    RuleEffects,
} from '@/components/program-rules'
import { cellKey, createCellStore } from '@/components/spreadsheet'
import { visit, visitForm } from './__tests__/rig'
import { connectRules } from './connectRules'
import { formEffects } from './formRows'
import type { TrackerEffectsState } from '../logic/effects'
import type { FormTables } from './openForm'

const by = {
    ruleId: 'rule',
    ruleName: 'Batch test',
    actionId: 'action',
    condition: 'true',
    readsFields: [],
}

const hiding = (): RuleEffects => {
    const effects = emptyEffects()
    effects.hiddenFields.set('c2', [by])
    return effects
}

const connect = (rules: EventsRules) => {
    const form = visitForm({
        rows: [visit('r1', 'Visit 1'), visit('r2', 'Visit 2')],
    })
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
    const store = createCellStore({
        fields: form.fields,
        values: form.values,
        settings,
        enqueue: () => {},
        annotations: effects,
    })
    const tables = createStore<FormTables>()(() => ({
        tables: form.tables,
        records: form.records,
    }))
    const stop = connectRules({
        open: {
            store,
            effects,
            tables,
            readOnlyRecords: form.readOnlyRecords,
            beforeComplete: new Set(),
        },
        form,
        rules,
        settings,
        announce: () => {},
        cleared: new Map(),
        touched: new Set(),
        ruleNotes: new Map(),
        seen: new Set(),
        idScope: 'data-entry',
    })
    return { store, effects, stop }
}

test('a batch edit evaluates all affected rows together and applies effects once', async () => {
    let hide = false
    const rules: EventsRules = {
        evaluate: vi.fn(
            (
                _rows: ReadonlyArray<EventsRuleRow>,
                rowIds: ReadonlyArray<string>
            ) => ({
                effects: new Map(
                    rowIds.map((rowId): [string, RuleEffects] => [
                        rowId,
                        hide ? hiding() : emptyEffects(),
                    ])
                ),
                failures: new Map<string, Error>(),
            })
        ),
        rowsAffectedBy: (_rows, rowId) => [rowId],
        invalidRules: [],
        optionGroupOptions: new Map(),
    }
    const { store, effects, stop } = connect(rules)
    const evaluate = vi.mocked(rules.evaluate)
    evaluate.mockClear()
    let effectUpdates = 0
    const unsubscribe = effects.subscribe(() => effectUpdates++)

    hide = true
    store.getState().commitMany([
        { key: cellKey('r1', 'c1'), text: '4' },
        { key: cellKey('r2', 'c1'), text: '5' },
    ])

    await expect.poll(() => evaluate).toHaveBeenCalledTimes(1)
    expect(evaluate.mock.calls[0]?.[1]).toEqual(['r1', 'r2'])
    await expect
        .poll(() => effects.getState().cells[cellKey('r2', 'c2')]?.hiddenBy)
        .toBe('Hidden by rule: Batch test')
    expect(effectUpdates).toBe(1)
    unsubscribe()
    stop()
})
