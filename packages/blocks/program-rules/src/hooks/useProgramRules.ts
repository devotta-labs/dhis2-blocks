import { useQuery } from '@tanstack/react-query'
import { Result } from 'better-result'
import { useCallback, useMemo } from 'react'
import {
    buildRuleContext,
    evaluateEventRules,
    explainField,
    type Attribution,
    type InvalidRule,
    type ProgramRulesMetadata,
    type RuleContext,
    type RuleDependencyGraph,
    type RuleEffects,
    type RuleEngineModule,
    type RuleEnrollmentInput,
    type RuleEventInput,
    type RuleOrgUnitGroupMetadata,
} from '../index'
import { shouldRetryProgramRulesRequest, useProgramRulesClient } from './client'
import { fetchRuleEnrollment } from './enrollment'
import { inputContentKey } from './inputKey'
import { useRuleEngine } from './loadRuleEngine'
import { fetchOrgUnitGroups, fetchProgramRulesMetadata } from './metadata'
import { programRulesQueryKeys } from './queryKeys'

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

const HOUR = 60 * 60_000
const NO_INVALID_RULES: InvalidRule[] = []
const NO_OPTION_GROUPS = new Map<string, Set<string>>()
const NO_GROUPS: string[] = []

const asError = (cause: unknown): Error =>
    cause instanceof Error ? cause : new Error(String(cause))

const buildContext = (
    engine: RuleEngineModule | undefined,
    metadata: ProgramRulesMetadata | undefined,
    orgUnitGroups?: ReadonlyArray<RuleOrgUnitGroupMetadata>
) =>
    engine === undefined || metadata === undefined
        ? undefined
        : Result.try({
              try: () =>
                  buildRuleContext(
                      engine,
                      orgUnitGroups === undefined
                          ? metadata
                          : { ...metadata, orgUnitGroups }
                  ),
              catch: asError,
          })

const okContext = (built: ReturnType<typeof buildContext>) =>
    built?.isOk() ? built.value : undefined

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
    const client = useProgramRulesClient()

    const ruleEngine = useRuleEngine(enabled)
    const metadataQuery = useQuery({
        queryKey: programRulesQueryKeys.metadata(programId),
        queryFn: ({ signal }) =>
            fetchProgramRulesMetadata(client, programId, signal),
        enabled,
        staleTime: HOUR,
        retry: shouldRetryProgramRulesRequest,
    })
    const engine = ruleEngine.engine

    const stageMetadata = useMemo(() => {
        const metadata = metadataQuery.data
        return (
            metadata && {
                ...metadata,
                rules: metadata.rules.filter(
                    (rule) =>
                        rule.programStageId === undefined ||
                        rule.programStageId === programStageId
                ),
            }
        )
    }, [metadataQuery.data, programStageId])

    const baseContext = useMemo(
        () => buildContext(engine, stageMetadata),
        [engine, stageMetadata]
    )
    const groups =
        okContext(baseContext)?.requirements.orgUnitGroups ?? NO_GROUPS
    const groupsQuery = useQuery({
        queryKey: programRulesQueryKeys.orgUnitGroups(groups),
        queryFn: ({ signal }) => fetchOrgUnitGroups(client, groups, signal),
        enabled: enabled && groups.length > 0,
        staleTime: HOUR,
        retry: shouldRetryProgramRulesRequest,
    })
    const groupedContext = useMemo(
        () =>
            groupsQuery.data === undefined
                ? undefined
                : buildContext(engine, stageMetadata, groupsQuery.data),
        [engine, stageMetadata, groupsQuery.data]
    )
    const builtContext = groups.length > 0 ? groupedContext : baseContext
    const context: RuleContext | undefined = okContext(builtContext)

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
    const failure = (
        query: { data?: unknown; error: Error | null },
        needed: boolean
    ) =>
        needed && query.data === undefined
            ? (query.error ?? undefined)
            : undefined
    const error =
        ruleEngine.error ??
        failure(metadataQuery, true) ??
        failure(groupsQuery, groups.length > 0) ??
        failure(enrollmentQuery, fetchEnrollment) ??
        (builtContext?.isErr() ? builtContext.error : undefined) ??
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
