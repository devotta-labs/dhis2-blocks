import { useQuery } from '@tanstack/react-query'
import { Result } from 'better-result'
import { useMemo } from 'react'
import {
    evaluateEventRules,
    type InvalidRule,
    type RuleDependencyGraph,
    type RuleEffects,
    type RuleEnrollmentInput,
    type RuleEventInput,
} from '../lib'
import { shouldRetryProgramRulesRequest } from './client'
import { fetchRuleEnrollment } from './enrollment'
import { eventContentKey, supplementContentKey } from './inputKey'
import { programRulesQueryKeys } from './queryKeys'
import {
    asError,
    neededFailure,
    useStageRuleContext,
} from './useProgramRuleContext'

export type ProgramRulesStatus = 'loading' | 'ready' | 'error'

export interface UseProgramRuleEvaluatorOptions {
    programId: string
    programStageId: string
    enrollmentId?: string
    /** Pass it to skip fetching the enrollment. */
    enrollment?: RuleEnrollmentInput
    /** Pass them to skip fetching the enrollment's events. */
    otherEvents?: ReadonlyArray<RuleEventInput>
    enabled?: boolean
}

/** The effects of one evaluation, or why the engine could not run the rules. */
export type RuleEvaluation = Result<RuleEffects, Error>

export interface UseProgramRuleEvaluatorResult {
    status: ProgramRulesStatus
    /**
     * Runs the rules for one event, with the enrollment and its other events. Present once all
     * the rules need has loaded. An event with the same content as a recent one gets the same
     * result object back, so callers can memoise on it. It is a new function when the rules or
     * the enrollment data change.
     */
    evaluate?: (event: RuleEventInput) => RuleEvaluation
    invalidRules: InvalidRule[]
    error?: Error
    graph?: RuleDependencyGraph
    /** optionGroupId → option codes, to resolve option group effects */
    optionGroupOptions: Map<string, Set<string>>
}

const NO_INVALID_RULES: InvalidRule[] = []
const NO_OPTION_GROUPS = new Map<string, Set<string>>()
/** Enough for a form that evaluates twice per change to keep both passes of the last few. */
const RECENT_EVALUATIONS = 8

/**
 * Program rules for any number of events of one stage, against one rule context. Use it to
 * evaluate several inputs (a form's two passes, a list of events) without building the context
 * once per input. Fetches the enrollment and its other events only when the rules read them and
 * the options don't carry them.
 */
export const useProgramRuleEvaluator = ({
    programId,
    programStageId,
    enrollmentId,
    enrollment,
    otherEvents,
    enabled = true,
}: UseProgramRuleEvaluatorOptions): UseProgramRuleEvaluatorResult => {
    const {
        client,
        engine,
        context,
        error: contextError,
    } = useStageRuleContext({ programId, programStageId, enabled })

    const needs = context?.requirements
    const needsEnrollment =
        needs !== undefined && needs.enrollment && enrollment === undefined
    const needsEvents =
        needs !== undefined && needs.otherEvents && otherEvents === undefined
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

    const supplementKey = supplementContentKey({ enrollment, otherEvents })
    const evaluate = useMemo(() => {
        if (context === undefined || engine === undefined || waiting) {
            return undefined
        }
        const supplement = {
            enrollment: enrollment ?? fetched?.enrollment,
            otherEvents: otherEvents ?? fetched?.events ?? [],
        }
        const recent = new Map<string, RuleEvaluation>()
        return (event: RuleEventInput): RuleEvaluation => {
            const key = eventContentKey(event)
            const cached = recent.get(key)
            if (cached !== undefined) {
                // Most recently used last, so the oldest is evicted first.
                recent.delete(key)
                recent.set(key, cached)
                return cached
            }
            const evaluation = Result.try({
                try: () =>
                    evaluateEventRules(engine, context, {
                        event,
                        ...supplement,
                    }),
                catch: asError,
            })
            recent.set(key, evaluation)
            if (recent.size > RECENT_EVALUATIONS) {
                recent.delete(recent.keys().next().value ?? '')
            }
            return evaluation
        }
        // `enrollment` and `otherEvents` are read through their content key, so new objects with
        // the same content keep the function and its recent results.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [context, engine, waiting, fetched, supplementKey])

    // A query only fails the hook while it is needed and has nothing to show:
    // a failed background refetch keeps the last good data, and so do we.
    const error =
        contextError ?? neededFailure(enrollmentQuery, fetchEnrollment)

    const progress = evaluate === undefined ? 'loading' : 'ready'
    return {
        status: error === undefined ? progress : 'error',
        evaluate,
        invalidRules: context?.invalidRules ?? NO_INVALID_RULES,
        error,
        graph: context?.graph,
        optionGroupOptions: context?.optionGroupOptions ?? NO_OPTION_GROUPS,
    }
}
