import type {
    Attribution,
    RuleEffects,
} from '@/registry/program-rules/use-program-rules'

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
 * What the form shows and saves: the stored values with the rule effects laid over them.
 * Stored values are never written to, so a field that is shown again gets its answer back.
 * A hidden field wins over an assignment to it.
 */
export const overlay = (
    stored: Values,
    effects: RuleEffects | undefined
): OverlayResult => {
    if (effects === undefined) {
        return { effective: stored, ruleChanges: [] }
    }
    const effective = { ...stored }
    const ruleChanges: RuleChange[] = []

    for (const [fieldId, attributions] of effects.hiddenFields) {
        const from = stored[fieldId]
        if (isEmpty(from)) {
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
        if (effects.hiddenFields.has(fieldId)) {
            continue
        }
        const from = isEmpty(stored[fieldId]) ? undefined : stored[fieldId]
        if (value === null || value === '') {
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
        } else if (value !== from) {
            effective[fieldId] = value
            ruleChanges.push({
                fieldId,
                kind: 'assigned',
                from,
                to: value,
                by,
            })
        }
    }

    return {
        effective: ruleChanges.length === 0 ? stored : effective,
        ruleChanges,
    }
}
