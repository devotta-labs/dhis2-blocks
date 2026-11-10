import { createStore } from 'zustand/vanilla'
import type { StoreApi } from 'zustand/vanilla'
import { emptyEffects } from '@/components/program-rules'
import type { EventsRules, RuleEffects } from '@/components/program-rules'
import { createCellStore } from '@/components/spreadsheet'
import type { CellKey, CellStoreState } from '@/components/spreadsheet'
import type { TrackerEffectsState } from '../../logic/effects'
import { connectRules } from '../connectRules'
import { formEffects } from '../formRows'
import type { FormTables } from '../openForm'
import { visit, visitForm } from './rig'

// Stand-in rules, to reach what the RMNCH rules never do: failures, slow rules, values the stand-in chooses.

export const by = {
    ruleId: 'rule',
    ruleName: 'Stand-in rule',
    actionId: 'action',
    condition: 'true',
    readsFields: [],
}

/** Rules that give each row what `effectsOf` says: effects, an error, or nothing (not evaluated). */
export const standIn = (
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

export const hiding = (field: string) => {
    const effects = emptyEffects()
    effects.hiddenFields.set(field, [by])
    return effects
}

/** Keeps the page busy, as slow rules do. */
export const busy = (ms: number) => {
    const end = performance.now() + ms
    while (performance.now() < end) {
        // the rules are thinking
    }
}

export const FIVE_ROWS = ['r1', 'r2', 'r3', 'r4', 'r5'].map((id) =>
    visit(id, id)
)

/** `visitForm`'s stores, wired to the rules as the provider wires them. */
export const connect = (
    rules: EventsRules,
    {
        before,
        ...options
    }: Parameters<typeof visitForm>[0] & {
        /** Runs on the store before the rules connect, as changes restored from the outbox do. */
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
    // As the provider does when the rules change: the same stores and session.
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
