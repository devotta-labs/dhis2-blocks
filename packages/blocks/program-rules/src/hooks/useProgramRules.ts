import { useQuery } from '@tanstack/react-query'
import { Result } from 'better-result'
import { useCallback, useMemo } from 'react'
import {
    evaluateEventRules,
    explainField,
    type Attribution,
    type InvalidRule,
    type RuleDependencyGraph,
    type RuleEffects,
    type RuleEnrollmentInput,
    type RuleEventInput,
} from '../index'
import { shouldRetryProgramRulesRequest } from './client'
import { fetchRuleEnrollment } from './enrollment'
import { inputContentKey } from './inputKey'
import { programRulesQueryKeys } from './queryKeys'
import {
    asError,
    neededFailure,
    useStageRuleContext,
} from './useProgramRuleContext'

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

export type ProgramRulesStatus = 'loading' | 'ready' | 'error'

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

const NO_INVALID_RULES: InvalidRule[] = []
const NO_OPTION_GROUPS = new Map<string, Set<string>>()

/**
 * Program rule effects for one event. Starts loading the rule engine on
 * mount, in parallel with the rule metadata; fetches the enrollment and its
 * other events only when the rules read them and `input` doesn't carry them.
 */
export const useProgramRules = ({
    programId,
    programStageId,
    enrollmentId,
    input,
    enabled = true,
}: UseProgramRulesOptions): UseProgramRulesResult => {
    const {
        client,
        engine,
        context,
        error: contextError,
    } = useStageRuleContext({ programId, programStageId, enabled })

    const needs = context?.requirements
    const needsEnrollment =
        needs !== undefined &&
        needs.enrollment &&
        input.enrollment === undefined
    const needsEvents =
        needs !== undefined &&
        needs.otherEvents &&
        input.otherEvents === undefined
    const fetchEnrollment =
        enrollmentId !== undefined && (needsEnrollment || needsEvents)
    const enrollmentQuery = useQuery({
        queryKey: programRulesQueryKeys.enrollment(
            enrollmentId ?? '',
            needsEvents
        ),
        queryFn: ({ signal }) =>
            fetchRuleEnrollment(
                client,
                enrollmentId ?? '',
                needsEvents,
                signal
            ),
        enabled: enabled && fetchEnrollment,
        staleTime: 60_000,
        retry: shouldRetryProgramRulesRequest,
    })
    const fetched = fetchEnrollment ? enrollmentQuery.data : undefined
    const waiting = fetchEnrollment && fetched === undefined

    const inputKey = inputContentKey(input)
    const evaluation = useMemo(
        () =>
            context === undefined || engine === undefined || waiting
                ? undefined
                : Result.try({
                      try: () =>
                          evaluateEventRules(engine, context, {
                              event: input.event,
                              enrollment:
                                  input.enrollment ?? fetched?.enrollment,
                              otherEvents:
                                  input.otherEvents ?? fetched?.events ?? [],
                          }),
                      catch: asError,
                  }),
        // `input` is read through its content key, so a new object with the
        // same content doesn't re-evaluate.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [context, engine, waiting, fetched, inputKey]
    )
    const effects = evaluation?.isOk() ? evaluation.value : undefined

    // A query only fails the hook while it is needed and has nothing to show:
    // a failed background refetch keeps the last good data, and so do we.
    const error =
        contextError ??
        neededFailure(enrollmentQuery, fetchEnrollment) ??
        (evaluation?.isErr() ? evaluation.error : undefined)

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
        invalidRules: context?.invalidRules ?? NO_INVALID_RULES,
        explain,
        error,
        graph: context?.graph,
        optionGroupOptions: context?.optionGroupOptions ?? NO_OPTION_GROUPS,
    }
}
