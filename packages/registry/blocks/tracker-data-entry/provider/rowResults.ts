import {
    emptyEffects,
    type EventsRulesEvaluation,
    type RuleEffects,
} from '@/components/program-rules'
import { rowRuleOutcome } from '../logic/ruleEffects'
import type { DataRecord } from '../model/types'

export interface RowResult {
    recordId: string
    outcome: ReturnType<typeof rowRuleOutcome> | Error
    raw?: RuleEffects
}

export const createRowResultAppender =
    (
        results: RowResult[],
        shown: ReadonlyMap<string, unknown>,
        seen: Set<string>,
        fieldsOf: (record: DataRecord) => Parameters<typeof rowRuleOutcome>[1]
    ) =>
    (
        rowId: string,
        record: DataRecord | undefined,
        empty: boolean,
        evaluation: EventsRulesEvaluation | undefined
    ) => {
        const raw = empty ? emptyEffects() : evaluation?.effects.get(rowId)
        const outcome =
            evaluation?.failures.get(rowId) ??
            (raw === undefined || record === undefined
                ? undefined
                : rowRuleOutcome(raw, fieldsOf(record)))
        if (shown.has(rowId) && outcome !== undefined) {
            results.push({ recordId: rowId, outcome, raw })
            seen.add(rowId)
        }
    }
