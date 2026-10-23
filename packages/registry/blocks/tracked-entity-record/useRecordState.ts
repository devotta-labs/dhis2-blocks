import {
    matchQuery,
    useQuery,
    useQueryClient,
    type Query,
    type UseQueryResult,
} from '@tanstack/react-query'
import { useCallback, useMemo, useRef } from 'react'
import { buildRecord, buildRelationships } from './buildRecord'
import { isUnavailableResponse, RecordRequestError } from './client'
import { trackedEntityRecordKeys } from './keys'
import {
    ownerOrgUnitsToCheck,
    programIdsToLoad,
    sortedUnique,
    toOwnerPaths,
    toUserScopes,
    type FailedRequest,
    type RecordSources,
} from './programState'
import {
    orgUnitPathsQuery,
    relationshipTypesQuery,
    userScopesQuery,
} from './queries'
import { useRecordClient } from './runtimeClient'
import { useTrackedEntityRecordQueries } from './useTrackedEntityRecordQueries'
import type {
    OrgUnitPathsResponse,
    PersonResponse,
    ProgramsResponse,
    RelationshipsResponse,
    RelationshipTypesResponse,
    TrackedEntityTypeResponse,
    UserScopesResponse,
} from './schemas'
import type {
    RelationshipsResult,
    TrackedEntityRecordContextValue,
    TrackedEntityRecordState,
} from './types'

// The only place that knows the record comes from React Query (spec 5). It
// runs the request plan of spec 8.2 and turns the answers into the state of
// spec 8.4.

/** One request's answer so far: its data, its failure, and how to ask again. */
interface Answer<T> {
    data: T | undefined
    error: Error | null
    retry(): void
}

const useAnswer = <T>(query: UseQueryResult<T, Error>): Answer<T> => {
    const { error, refetch } = query
    // A host's placeholderData (e.g. keepPreviousData) is another key's answer,
    // possibly another person's: never build the record from it.
    const data = query.isPlaceholderData ? undefined : query.data
    return useMemo(
        () => ({
            data,
            error,
            retry: () => {
                void refetch()
            },
        }),
        [data, error, refetch]
    )
}

const EMPTY_PROGRAMS: ProgramsResponse = { programs: [] }
const NO_PROGRAMS: Answer<ProgramsResponse> = {
    data: EMPTY_PROGRAMS,
    error: null,
    retry: () => undefined,
}
const NO_RELATIONSHIP_TYPES: RelationshipTypesResponse = {
    relationshipTypes: [],
}
const PENDING: TrackedEntityRecordState = { status: 'pending' }
const RELATIONSHIPS_PENDING: RelationshipsResult = { status: 'pending' }

const SEPARATOR = '\u0000'

/** Unique ids, first occurrence kept, as one string. */
const idsKey = (ids: readonly string[]) => [...new Set(ids)].join(SEPARATOR)
const fromKey = (key: string) => (key === '' ? [] : key.split(SEPARATOR))

/**
 * The `programs` prop as stable values: an inline array with the same ids
 * gives the same arrays, so it never starts a request or rebuilds the record.
 * `requestedPrograms` keeps the host's order (spec 7.2); `requestedIds` is the
 * sorted, deduplicated set the programs request asks for.
 */
const useProgramsProp = (programs?: readonly string[]) => {
    const orderKey = programs && idsKey(programs)
    const sortedKey = programs && idsKey([...programs].sort())
    const requestedPrograms = useMemo(
        () => (orderKey === undefined ? undefined : fromKey(orderKey)),
        [orderKey]
    )
    const requestedIds = useMemo(
        () => (sortedKey === undefined ? undefined : fromKey(sortedKey)),
        [sortedKey]
    )
    return { orderKey, requestedPrograms, requestedIds }
}

/** Spec 7.1: the server's "not there for you" answers. */
const isUnavailable = (error: Error) =>
    error instanceof RecordRequestError && isUnavailableResponse(error)

/** A request that failed and has nothing to show for it. */
const failureOf = <T>(answer: Answer<T>): FailedRequest | undefined =>
    answer.data === undefined && answer.error
        ? { error: answer.error, retry: answer.retry }
        : undefined

const errorState = (failure: FailedRequest): TrackedEntityRecordState => ({
    status: 'error',
    error: failure.error,
    retry: failure.retry,
})

interface RelationshipInputs {
    personId: string
    relationships: Answer<RelationshipsResponse>
    typeIds: readonly string[]
    types: Answer<RelationshipTypesResponse>
}

/** Spec 8.3: loaded on the side; a failure here never blocks the record. */
const resolveRelationships = (
    inputs: RelationshipInputs
): RelationshipsResult => {
    const { data } = inputs.relationships
    if (data === undefined) {
        const failure = failureOf(inputs.relationships)
        return failure ? { status: 'error', ...failure } : RELATIONSHIPS_PENDING
    }
    const types =
        inputs.typeIds.length === 0 ? NO_RELATIONSHIP_TYPES : inputs.types.data
    if (types === undefined) {
        const failure = failureOf(inputs.types)
        return failure ? { status: 'error', ...failure } : RELATIONSHIPS_PENDING
    }
    return {
        status: 'ready',
        relationships: buildRelationships(inputs.personId, data, types),
    }
}

interface ScopeInputs {
    needed: boolean
    scopes: Answer<UserScopesResponse>
    ownerPaths: Answer<OrgUnitPathsResponse>
}

type ScopeSources = Pick<RecordSources, 'scopes' | 'ownerPaths' | 'scopesError'>

/**
 * Spec 7.3 case 2: the scope lookups once they answered or failed; undefined
 * while they are still loading, as the builder would read "not loaded" as
 * `unavailable`.
 */
const resolveScopes = (inputs: ScopeInputs): ScopeSources | undefined => {
    if (!inputs.needed) return {}
    const { scopes, ownerPaths } = inputs
    if (scopes.data !== undefined && ownerPaths.data !== undefined) {
        return {
            scopes: toUserScopes(scopes.data),
            ownerPaths: toOwnerPaths(ownerPaths.data),
        }
    }
    const failures = [failureOf(scopes), failureOf(ownerPaths)].filter(
        (failure) => failure !== undefined
    )
    const [first] = failures
    if (!first) return undefined
    return {
        scopesError: {
            error: first.error,
            retry: () => failures.forEach((failure) => failure.retry()),
        },
    }
}

interface StateInputs {
    person: Answer<PersonResponse>
    trackedEntityType: Answer<TrackedEntityTypeResponse>
    programs: Answer<ProgramsResponse>
    scopes: ScopeInputs
    requestedPrograms?: readonly string[]
    relationships: RelationshipsResult
}

/** Spec 8.4: pending until the person, its type and every program have a state. */
const resolveState = (inputs: StateInputs): TrackedEntityRecordState => {
    const { person, trackedEntityType, programs } = inputs
    // The server's current answer wins, even over a record already shown.
    if (person.error && isUnavailable(person.error)) {
        return { status: 'unavailable', debug: person.error.message }
    }
    if (person.data === undefined) {
        const failure = failureOf(person)
        return failure ? errorState(failure) : PENDING
    }
    if (trackedEntityType.data === undefined) {
        const failure = failureOf(trackedEntityType)
        return failure ? errorState(failure) : PENDING
    }
    const base = {
        person: person.data,
        trackedEntityType: trackedEntityType.data,
        requestedPrograms: inputs.requestedPrograms,
        relationships: inputs.relationships,
    }
    if (programs.data === undefined) {
        const programsError = failureOf(programs)
        if (!programsError) return PENDING
        // The person stays ready; every program shows the failure.
        return {
            status: 'ready',
            record: buildRecord({
                ...base,
                programs: EMPTY_PROGRAMS,
                programsError,
            }),
        }
    }
    const scopes = resolveScopes(inputs.scopes)
    if (scopes === undefined) return PENDING
    return {
        status: 'ready',
        record: buildRecord({ ...base, programs: programs.data, ...scopes }),
    }
}

interface ShownRecord {
    trackedEntityId: string
    programsKey: string | undefined
    state: TrackedEntityRecordState
}

export const useRecordState = (
    trackedEntityId: string,
    programs?: readonly string[]
): TrackedEntityRecordContextValue => {
    const client = useRecordClient()
    // The public options, so views reading them share these cache entries.
    const queries = useTrackedEntityRecordQueries()
    const queryClient = useQueryClient()
    const {
        orderKey: programsKey,
        requestedPrograms,
        requestedIds,
    } = useProgramsProp(programs)

    // (1) the person and (4) relationships start at once.
    const personQueryResult = useQuery(queries.person(trackedEntityId))
    const relationshipsQueryResult = useQuery(
        queries.relationships(trackedEntityId)
    )
    const person = useAnswer(personQueryResult)
    const relationships = useAnswer(relationshipsQueryResult)

    // (3) needs the person's type.
    const typeId = person.data?.trackedEntityType
    const trackedEntityTypeQueryResult = useQuery({
        ...queries.trackedEntityType(typeId ?? ''),
        enabled: typeId !== undefined,
    })
    const trackedEntityType = useAnswer(trackedEntityTypeQueryResult)

    // (2) starts at once with the programs prop; else it waits for the person.
    const programIds = useMemo(
        () =>
            requestedIds ??
            (person.data === undefined
                ? undefined
                : programIdsToLoad(person.data)),
        [requestedIds, person.data]
    )
    const hasProgramIds = programIds !== undefined && programIds.length > 0
    const programsQueryResult = useQuery({
        ...queries.programs(programIds ?? []),
        enabled: hasProgramIds,
    })
    const programsAnswer = useAnswer(programsQueryResult)
    const programsLoaded =
        programIds !== undefined && !hasProgramIds
            ? NO_PROGRAMS
            : programsAnswer

    // (5) only when a program has an owner but no visible enrollment.
    const owners = useMemo(
        () =>
            person.data === undefined || programsLoaded.data === undefined
                ? []
                : ownerOrgUnitsToCheck(
                      person.data,
                      programsLoaded.data,
                      requestedPrograms
                  ),
        [person.data, programsLoaded.data, requestedPrograms]
    )
    const needsScopes = owners.length > 0
    const scopesQueryResult = useQuery({
        ...userScopesQuery(client),
        enabled: needsScopes,
    })
    const ownerPathsQueryResult = useQuery({
        ...orgUnitPathsQuery(client, owners),
        enabled: needsScopes,
    })
    const scopes = useAnswer(scopesQueryResult)
    const ownerPaths = useAnswer(ownerPathsQueryResult)

    // Names for the relationship types in the answer.
    const relationshipTypeIds = useMemo(
        () =>
            sortedUnique(
                relationships.data?.relationships.map(
                    ({ relationshipType }) => relationshipType
                ) ?? []
            ),
        [relationships.data]
    )
    const relationshipTypesQueryResult = useQuery({
        ...relationshipTypesQuery(client, relationshipTypeIds),
        enabled: relationshipTypeIds.length > 0,
    })
    const relationshipTypes = useAnswer(relationshipTypesQueryResult)

    const relationshipsResult = useMemo(
        () =>
            resolveRelationships({
                personId: trackedEntityId,
                relationships,
                typeIds: relationshipTypeIds,
                types: relationshipTypes,
            }),
        [trackedEntityId, relationships, relationshipTypeIds, relationshipTypes]
    )

    const resolved = useMemo(
        () =>
            resolveState({
                person,
                trackedEntityType,
                programs: programsLoaded,
                scopes: { needed: needsScopes, scopes, ownerPaths },
                requestedPrograms,
                relationships: relationshipsResult,
            }),
        [
            person,
            trackedEntityType,
            programsLoaded,
            needsScopes,
            scopes,
            ownerPaths,
            requestedPrograms,
            relationshipsResult,
        ]
    )

    // Once shown, a record stays shown while its next answers load (spec
    // 8.4), but only for the same person and programs prop: another id or
    // program list starts at pending, never showing the old set (spec 7.2).
    const shown = useRef<ShownRecord | undefined>(undefined)
    let state = resolved
    if (resolved.status === 'ready') {
        shown.current = { trackedEntityId, programsKey, state: resolved }
    } else if (resolved.status === 'unavailable') {
        shown.current = undefined
    } else if (
        resolved.status === 'pending' &&
        shown.current?.trackedEntityId === trackedEntityId &&
        shown.current.programsKey === programsKey
    ) {
        state = shown.current.state
    }

    const isFetching = [
        personQueryResult,
        relationshipsQueryResult,
        trackedEntityTypeQueryResult,
        programsQueryResult,
        scopesQueryResult,
        ownerPathsQueryResult,
        relationshipTypesQueryResult,
    ].some((query) => query.isFetching)

    // Spec 10.3: everything under the person's scope, any block's; not
    // metadata. Only the person's refetch can reject: relationships never
    // block the record (spec 8.3). Other views refetch alongside but are not
    // waited for: their pace and failures are theirs to show.
    const refresh = useCallback(async () => {
        const personKey = trackedEntityRecordKeys.person(trackedEntityId)
        const relationshipsKey =
            trackedEntityRecordKeys.relationships(trackedEntityId)
        const isRecordQuery = (query: Query) =>
            matchQuery({ queryKey: personKey, exact: true }, query) ||
            matchQuery({ queryKey: relationshipsKey, exact: true }, query)
        // Never rejects without throwOnError.
        void queryClient.invalidateQueries({
            queryKey: trackedEntityRecordKeys.scope(trackedEntityId),
            predicate: (query) => !isRecordQuery(query),
        })
        await Promise.all([
            queryClient.invalidateQueries(
                { queryKey: personKey, exact: true },
                { throwOnError: true }
            ),
            queryClient.invalidateQueries({
                queryKey: relationshipsKey,
                exact: true,
            }),
        ])
    }, [queryClient, trackedEntityId])

    return useMemo(
        () => ({
            state,
            actions: { refresh },
            meta: { trackedEntityId, isFetching },
        }),
        [state, refresh, trackedEntityId, isFetching]
    )
}
