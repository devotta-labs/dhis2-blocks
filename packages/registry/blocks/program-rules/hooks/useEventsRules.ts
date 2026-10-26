import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Result } from 'better-result'
import { useMemo } from 'react'
import {
    buildRuleContext,
    crossEventFields,
    emptyEffects,
    evaluateEventsRules,
    metadataForStage,
    rowsAffectedBy,
    type EventsRuleRow,
    type EventsRulesEvaluation,
    type InvalidRule,
    type ProgramRulesMetadata,
    type RuleContext,
    type RuleEngineModule,
    type RuleEnrollmentData,
    type RuleOrgUnitGroupMetadata,
} from '../lib'
import { shouldRetryProgramRulesRequest, useProgramRulesClient } from './client'
import { fetchRuleEnrollments } from './enrollment'
import { useRuleEngine } from './loadRuleEngine'
import { fetchOrgUnitGroups, fetchProgramRulesMetadata } from './metadata'
import { programRulesQueryKeys } from './queryKeys'
import { asError, neededFailure } from './useProgramRuleContext'
import type { ProgramRulesStatus } from './useProgramRuleEvaluator'

export interface UseEventsRulesOptions {
    programId: string
    /** The stages the grid's rows belong to; one rule context is built for each. */
    programStageIds: ReadonlyArray<string>
    /** WITH_REGISTRATION programs; false evaluates every row alone. */
    tracker: boolean
    /** The people the rows belong to, fetched together in one request. */
    enrollmentIds: ReadonlyArray<string>
    enabled?: boolean
}

export interface EventsRules {
    /**
     * Runs the rules of the rows named by `rowIds` against `rows`, the grid's live values, each row on its own: a row
     * the engine fails on is in `failures`, the others in `effects`. A row of a tracker program sees its person's other
     * events: the server's, each replaced by its live row, plus the live rows the server lacks. A row that is not in
     * `rows`, whose stage was not asked for, or whose person was added to `enrollmentIds` and has not loaded yet, is in
     * neither map: it was not evaluated.
     */
    evaluate(
        rows: ReadonlyArray<EventsRuleRow>,
        rowIds: ReadonlyArray<string>
    ): EventsRulesEvaluation
    /**
     * The rows to run again after `fieldId` changed in `rowId`: the row itself, and for a field other events read, the
     * person's other rows. Covers data value edits only. After an event date changes, or a row is added or removed,
     * run every row of that person: which event is newest or previous changes. A deleted event stays in the cached
     * people until `[...programRulesQueryKeys.all, 'enrollments']` is invalidated. An event program's row is always
     * alone.
     */
    rowsAffectedBy(
        rows: ReadonlyArray<EventsRuleRow>,
        rowId: string,
        fieldId: string
    ): string[]
    /** Rules the engine cannot parse, each listed once however many stages carry it. */
    invalidRules: InvalidRule[]
    /** optionGroupId → option codes, to resolve option group effects */
    optionGroupOptions: Map<string, Set<string>>
}

export interface UseEventsRulesResult {
    status: ProgramRulesStatus
    /**
     * Present once the engine, the metadata and the people the rules read have loaded, and from then on while a new
     * person loads; for a program without rules, once the metadata has. Stable while its inputs are.
     */
    rules?: EventsRules
    error?: Error
}

const HOUR = 60 * 60_000
const NO_PERSONS = new Map<string, RuleEnrollmentData>()

/** A program without rules: every row is evaluated, to nothing, and stands alone. */
const NO_RULES: EventsRules = {
    evaluate: (rows, rowIds) => {
        const ids = new Set(rows.map((row) => row.event.id))
        return {
            effects: new Map(
                rowIds
                    .filter((rowId) => ids.has(rowId))
                    .map((rowId) => [rowId, emptyEffects()])
            ),
            failures: new Map(),
        }
    },
    rowsAffectedBy: (_rows, rowId) => [rowId],
    invalidRules: [],
    optionGroupOptions: new Map(),
}

type StageContexts = Result<Map<string, RuleContext>, Error>

const buildContexts = (
    engine: RuleEngineModule | undefined,
    metadata: ProgramRulesMetadata | undefined,
    stageIds: ReadonlyArray<string>,
    orgUnitGroups?: ReadonlyArray<RuleOrgUnitGroupMetadata>
): StageContexts | undefined =>
    engine === undefined || metadata === undefined
        ? undefined
        : Result.try({
              try: () =>
                  new Map(
                      stageIds.map((stageId): [string, RuleContext] => {
                          const forStage = metadataForStage(metadata, stageId)
                          return [
                              stageId,
                              buildRuleContext(
                                  engine,
                                  orgUnitGroups === undefined
                                      ? forStage
                                      : { ...forStage, orgUnitGroups }
                              ),
                          ]
                      })
                  ),
              catch: asError,
          })

/** The requested rows whose person has loaded; a row without a person has nothing to wait for. */
const withLoadedPerson = (
    rows: ReadonlyArray<EventsRuleRow>,
    persons: ReadonlyMap<string, RuleEnrollmentData>,
    rowIds: ReadonlyArray<string>
): string[] => {
    const personOf = new Map(
        rows.map((row) => [row.event.id, row.enrollmentId])
    )
    return rowIds.filter((rowId) => {
        const enrollmentId = personOf.get(rowId)
        return enrollmentId === undefined || persons.has(enrollmentId)
    })
}

/** Program-wide rules sit in every stage's context, so the same rule would be listed once per stage. */
const distinctInvalidRules = (
    contexts: Iterable<RuleContext>
): InvalidRule[] => [
    ...new Map(
        [...contexts]
            .flatMap((context) => context.invalidRules)
            .map((rule): [string, InvalidRule] => [
                `${rule.ruleId}:${rule.actionId ?? ''}`,
                rule,
            ])
    ).values(),
]

/** Group ids are global, so each stage's groups merge into one map. */
const allOptionGroups = (
    contexts: Iterable<RuleContext>
): Map<string, Set<string>> =>
    new Map([...contexts].flatMap((context) => [...context.optionGroupOptions]))

/**
 * Program rules for a grid of events: any number of rows across stages, evaluated on the grid's live values. Loads the
 * rule metadata and, for a program with rules, the engine, a rule context for each stage and, for a tracker program
 * whose rules read the enrollment or other events, every person in one batched request. Shares the metadata query and
 * the engine with the other hooks.
 */
export const useEventsRules = ({
    programId,
    programStageIds,
    tracker,
    enrollmentIds,
    enabled = true,
}: UseEventsRulesOptions): UseEventsRulesResult => {
    const client = useProgramRulesClient()

    const metadataQuery = useQuery({
        queryKey: programRulesQueryKeys.metadata(programId),
        queryFn: ({ signal }) =>
            fetchProgramRulesMetadata(client, programId, signal),
        enabled,
        staleTime: HOUR,
        retry: shouldRetryProgramRulesRequest,
    })
    const metadata = metadataQuery.data
    const hasRules = metadata !== undefined && metadata.rules.length > 0
    const ruleEngine = useRuleEngine(enabled && hasRules)
    // Another hook may have loaded the engine already; a program without rules still needs no context.
    const engine = hasRules ? ruleEngine.engine : undefined

    // Read through its content, so a new array of the same stages keeps the contexts.
    const stageKey = [...new Set(programStageIds)].sort().join(',')
    const stageIds = useMemo(
        () => (stageKey === '' ? [] : stageKey.split(',')),
        [stageKey]
    )
    const baseContexts = useMemo(
        () => buildContexts(engine, metadata, stageIds),
        [engine, metadata, stageIds]
    )
    const requirements = [
        ...((baseContexts?.isOk() ? baseContexts.value : undefined)?.values() ??
            []),
    ].map((context) => context.requirements)

    const groups = [
        ...new Set(requirements.flatMap((needs) => needs.orgUnitGroups)),
    ]
    const groupsQuery = useQuery({
        queryKey: programRulesQueryKeys.orgUnitGroups(groups),
        queryFn: ({ signal }) => fetchOrgUnitGroups(client, groups, signal),
        enabled: enabled && groups.length > 0,
        staleTime: HOUR,
        retry: shouldRetryProgramRulesRequest,
    })
    const groupedContexts = useMemo(
        () =>
            groupsQuery.data === undefined
                ? undefined
                : buildContexts(engine, metadata, stageIds, groupsQuery.data),
        [engine, metadata, stageIds, groupsQuery.data]
    )
    const built = groups.length > 0 ? groupedContexts : baseContexts
    const contexts = built?.isOk() ? built.value : undefined

    const withEvents = requirements.some((needs) => needs.otherEvents)
    const needsPersons =
        tracker &&
        requirements.some((needs) => needs.enrollment || needs.otherEvents)
    const personIds = [...new Set(enrollmentIds)]
    const fetchPersons = needsPersons && personIds.length > 0
    const personsQuery = useQuery({
        queryKey: programRulesQueryKeys.enrollments(personIds, withEvents),
        // Cached as entries: a persisted query cache restores a Map as an empty object.
        queryFn: async ({ signal }) => [
            ...(await fetchRuleEnrollments(
                client,
                personIds,
                withEvents,
                signal
            )),
        ],
        enabled: enabled && fetchPersons,
        staleTime: 60_000,
        retry: shouldRetryProgramRulesRequest,
        // The people already loaded stay in use while a new one is fetched.
        placeholderData: keepPreviousData,
    })
    const loadingMorePersons = fetchPersons && personsQuery.isPlaceholderData
    const fetchedPersons = personsQuery.data
    const persons = useMemo(
        () =>
            fetchPersons
                ? fetchedPersons && new Map(fetchedPersons)
                : NO_PERSONS,
        [fetchPersons, fetchedPersons]
    )

    const rules = useMemo((): EventsRules | undefined => {
        if (metadata !== undefined && metadata.rules.length === 0) {
            return NO_RULES
        }
        if (
            engine === undefined ||
            metadata === undefined ||
            contexts === undefined ||
            persons === undefined
        ) {
            return undefined
        }
        const crossFields = crossEventFields(metadata)
        return {
            evaluate: (rows, rowIds) =>
                evaluateEventsRules(
                    engine,
                    contexts,
                    { rows, persons, tracker },
                    loadingMorePersons
                        ? withLoadedPerson(rows, persons, rowIds)
                        : rowIds
                ),
            // An event program's events share one hidden enrollment and must never couple.
            rowsAffectedBy: (rows, rowId, fieldId) =>
                tracker
                    ? rowsAffectedBy(rows, crossFields, rowId, fieldId)
                    : [rowId],
            invalidRules: distinctInvalidRules(contexts.values()),
            optionGroupOptions: allOptionGroups(contexts.values()),
        }
    }, [engine, metadata, contexts, persons, tracker, loadingMorePersons])

    // A query only fails the hook while it is needed and has nothing to show:
    // a failed background refetch keeps the last good data, and so do we.
    const error =
        ruleEngine.error ??
        neededFailure(metadataQuery, true) ??
        neededFailure(groupsQuery, groups.length > 0) ??
        (built?.isErr() ? built.error : undefined) ??
        neededFailure(personsQuery, fetchPersons)

    return {
        status:
            error !== undefined
                ? 'error'
                : rules === undefined
                  ? 'loading'
                  : 'ready',
        rules,
        error,
    }
}
