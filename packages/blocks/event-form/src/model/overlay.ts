import type {
    Attribution,
    RuleEffects,
} from '@/registry/program-rules/use-program-rules'
import type { DataElementMeta, StageMetadata } from '../api/schemas'

/** Field id to value, in tracker API format. Empty values are absent, never ''. */
export type Values = Readonly<Record<string, string>>

export interface RuleChange {
    fieldId: string
    kind: 'cleared' | 'assigned'
    from: string | undefined
    to: string | undefined
    by: Attribution
}

interface OverlayResult {
    effective: Values
    ruleChanges: RuleChange[]
}

const isEmpty = (value: string | undefined): value is undefined | '' =>
    value === undefined || value === ''

/**
 * The value an ASSIGN saves, or `undefined` to clear the field. A value outside the field's
 * option set (for MULTI_TEXT, any comma-separated part outside it) clears it, as in Capture,
 * since the server rejects it.
 */
const assignedValueOf = (
    value: string | null,
    meta: DataElementMeta
): string | undefined => {
    if (value === null || value === '') {
        return undefined
    }
    if (meta.options === undefined) {
        return value
    }
    const codes = new Set(meta.options.map((option) => option.code))
    const parts = meta.valueType === 'MULTI_TEXT' ? value.split(',') : [value]
    return parts.every((part) => codes.has(part)) ? value : undefined
}

/**
 * What the form shows and saves: the stored values with the rule effects laid over them.
 * Stored values are never written to, so a field that is shown again gets its answer back.
 * An assignment wins over hiding, as in Capture: a hidden field still saves its assigned value.
 * Assignments to data elements outside the stage are dropped.
 */
export const overlay = (
    stored: Values,
    effects: RuleEffects | undefined,
    dataElements: StageMetadata['dataElements']
): OverlayResult => {
    if (effects === undefined) {
        return { effective: stored, ruleChanges: [] }
    }
    const effective = { ...stored }
    const ruleChanges: RuleChange[] = []

    const assigns = (fieldId: string) =>
        effects.assignedValues.has(fieldId) && dataElements.has(fieldId)

    for (const [fieldId, attributions] of effects.hiddenFields) {
        const from = stored[fieldId]
        if (isEmpty(from) || assigns(fieldId)) {
            continue
        }
        delete effective[fieldId]
        const by = attributions[0]
        if (by !== undefined) {
            ruleChanges.push({
                fieldId,
                kind: 'cleared',
                from,
                to: undefined,
                by,
            })
        }
    }

    for (const [fieldId, { value, by }] of effects.assignedValues) {
        const meta = dataElements.get(fieldId)
        if (meta === undefined) {
            continue
        }
        const from = isEmpty(stored[fieldId]) ? undefined : stored[fieldId]
        const to = assignedValueOf(value, meta)
        if (to === undefined) {
            if (from !== undefined) {
                delete effective[fieldId]
                ruleChanges.push({
                    fieldId,
                    kind: 'cleared',
                    from,
                    to: undefined,
                    by,
                })
            }
        } else if (to !== from) {
            effective[fieldId] = to
            ruleChanges.push({
                fieldId,
                kind: 'assigned',
                from,
                to,
                by,
            })
        }
    }

    return {
        effective: ruleChanges.length === 0 ? stored : effective,
        ruleChanges,
    }
}
