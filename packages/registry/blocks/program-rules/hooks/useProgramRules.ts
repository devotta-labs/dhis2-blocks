import { useCallback } from 'react'
import {
    explainField,
    type Attribution,
    type InvalidRule,
    type RuleDependencyGraph,
    type RuleEffects,
    type RuleEnrollmentInput,
    type RuleEventInput,
} from '../lib'
import {
    useProgramRuleEvaluator,
    type ProgramRulesStatus,
} from './useProgramRuleEvaluator'

export type { ProgramRulesStatus } from './useProgramRuleEvaluator'

export interface ProgramRulesInput {
    event: RuleEventInput
    /** Pass it to skip fetching the enrollment. */
    enrollment?: RuleEnrollmentInput
    /** Pass them to skip fetching the enrollment's events. */
    otherEvents?: ReadonlyArray<RuleEventInput>
}

export interface UseProgramRulesOptions {
    programId: string
    programStageId: string
    enrollmentId?: string
    /** Evaluation reruns only when its content changes; pass committed values. */
    input: ProgramRulesInput
    enabled?: boolean
}

export interface UseProgramRulesResult {
    status: ProgramRulesStatus
    effects?: RuleEffects
    invalidRules: InvalidRule[]
    explain: (fieldId: string) => Attribution[]
    error?: Error
    graph?: RuleDependencyGraph
    /** optionGroupId → option codes, to resolve option group effects */
    optionGroupOptions: Map<string, Set<string>>
}

/**
 * Program rule effects for one event. Starts loading the rule engine on
 * mount, in parallel with the rule metadata; fetches the enrollment and its
 * other events only when the rules read them and `input` doesn't carry them.
 * To evaluate more than one event against the same rules, use
 * `useProgramRuleEvaluator`.
 */
export const useProgramRules = ({
    programId,
    programStageId,
    enrollmentId,
    input,
    enabled = true,
}: UseProgramRulesOptions): UseProgramRulesResult => {
    const evaluator = useProgramRuleEvaluator({
        programId,
        programStageId,
        enrollmentId,
        enrollment: input.enrollment,
        otherEvents: input.otherEvents,
        enabled,
    })
    // Memoised on the event's content, so a new input with the same content
    // returns the same effects.
    const evaluation = evaluator.evaluate?.(input.event)
    const effects = evaluation?.isOk() ? evaluation.value : undefined
    const error =
        evaluator.error ?? (evaluation?.isErr() ? evaluation.error : undefined)

    const explain = useCallback(
        (fieldId: string) =>
            effects === undefined ? [] : explainField(effects, fieldId),
        [effects]
    )

    return {
        status:
            error !== undefined
                ? 'error'
                : effects === undefined
                  ? 'loading'
                  : 'ready',
        effects,
        invalidRules: evaluator.invalidRules,
        explain,
        error,
        graph: evaluator.graph,
        optionGroupOptions: evaluator.optionGroupOptions,
    }
}
