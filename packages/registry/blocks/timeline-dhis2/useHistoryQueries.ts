import i18n from '@dhis2/d2-i18n'
import {
    keepPreviousData,
    useQueries,
    useQuery,
    type UseQueryResult,
} from '@tanstack/react-query'
import { Result } from 'better-result'
import { useMemo, useState } from 'react'
import type {
    TimelineNotice,
    TimelineStatus,
} from '@/components/timeline/core/types'
import type { TimelineClient } from './client'
import { toProgramInfo } from './metadata'
import {
    fetchOrgUnitNames,
    fetchProgramTimelineMetadata,
    fetchTrackedEntity,
} from './queries'
import type { TrackedEntity } from './schemas'
import { timelineKeys } from './timelineKeys'
import type { ProgramInfo } from './types'
import { useTimelineClient } from './useTimelineClient'

/** Unwraps a fetcher's result for a query function, which reports by throwing. */
export const unwrap = <T>(result: Result<T, Error>): T => {
    if (Result.isError(result)) {
        throw result.error
    }
    return result.value
}

/**
 * Whether a query has an answer to show, failed with none, or is still on its
 * way. A query that failed and is being retried still counts as failed:
 * TanStack Query puts it back to `pending`, which would hide everything else
 * while it retries.
 */
export const statusOf = (query: {
    data: unknown
    isError: boolean
    errorUpdateCount: number
}): TimelineStatus =>
    query.data !== undefined
        ? 'success'
        : query.isError || query.errorUpdateCount > 0
          ? 'error'
          : 'pending'

/** Refetches without cancelling a request already on its way for the same key. */
export const refetchOf = (query: Pick<UseQueryResult, 'refetch'>) => () =>
    void query.refetch({ cancelRefetch: false })

/**
 * True once `settled` has been true for this `subject` (the tracked entity
 * and programs). After that a history never goes back to showing nothing:
 * a new program or a new set of org units fills in when it arrives.
 */
export const useSettledOnce = (settled: boolean, subject: string): boolean => {
    const [settledFor, setSettledFor] = useState<string>()
    // Adjusting state while rendering, as React documents for derived state.
    if (settled && settledFor !== subject) {
        setSettledFor(subject)
    }
    return settled || settledFor === subject
}

const trackedEntityQuery = (client: TimelineClient, trackedEntity: string) => ({
    queryKey: timelineKeys.trackedEntity(trackedEntity),
    queryFn: async ({ signal }: { signal: AbortSignal }) =>
        unwrap(await fetchTrackedEntity(client, { trackedEntity }, signal)),
})

/** The tracked entity and its enrollments in every program. */
export const useTrackedEntity = (
    trackedEntity: string
): UseQueryResult<TrackedEntity> => {
    const client = useTimelineClient()
    return useQuery(trackedEntityQuery(client, trackedEntity))
}

export interface ProgramIds {
    /** Undefined until the enrollments have answered. */
    ids?: string[]
    status: TimelineStatus
    isFetching: boolean
    refetch(): void
    notices: TimelineNotice[]
}

const sortedUnique = (ids: Iterable<string>) => [...new Set(ids)].sort()

/**
 * The programs a history covers: `programs` when given, otherwise every
 * program the tracked entity is enrolled in (one request, shared with the
 * enrollments).
 */
export const useProgramIds = ({
    trackedEntity,
    programs,
}: {
    trackedEntity: string
    programs?: ReadonlyArray<string>
}): ProgramIds => {
    const client = useTimelineClient()
    const given = programs !== undefined
    const entity = useQuery({
        ...trackedEntityQuery(client, trackedEntity),
        enabled: !given,
    })
    const programKey = programs?.join(',')
    const enrolledKey = entity.data?.enrollments
        .map((enrollment) => enrollment.program)
        .join(',')
    const ids = useMemo(
        () =>
            programKey !== undefined
                ? sortedUnique(programKey === '' ? [] : programKey.split(','))
                : enrolledKey !== undefined
                  ? sortedUnique(
                        enrolledKey === '' ? [] : enrolledKey.split(',')
                    )
                  : undefined,
        [programKey, enrolledKey]
    )
    if (given) {
        return {
            ids,
            status: 'success',
            isFetching: false,
            refetch: () => undefined,
            notices: [],
        }
    }
    const status = statusOf(entity)
    return {
        ids,
        status,
        isFetching: entity.isFetching,
        refetch: refetchOf(entity),
        notices:
            status === 'error'
                ? [
                      {
                          id: 'enrollments-failed',
                          tone: 'error',
                          message: i18n.t("The enrollments couldn't load."),
                          retry: refetchOf(entity),
                      },
                  ]
                : [],
    }
}

export interface ProgramInfoResult {
    programs: ReadonlyMap<string, ProgramInfo>
    /** Some program's metadata has not answered yet. */
    pending: boolean
    /** The programs whose metadata has not answered yet. */
    pendingIds: ReadonlySet<string>
    isFetching: boolean
    notices: TimelineNotice[]
}

const NO_PROGRAMS: ReadonlyMap<string, ProgramInfo> = new Map()

/** A query not yet asked for: pending. */
const NOT_ASKED = { data: undefined, isError: false, errorUpdateCount: 0 }

/** The display name of a program for notices: its name once known, else its id. */
export const programLabel = (
    programs: ReadonlyMap<string, ProgramInfo>,
    id: string
) => programs.get(id)?.name ?? id

/**
 * Each program's stages, data elements and attributes, one request per
 * program. Metadata doesn't change during a session, so it is never
 * refetched behind the user's back. A program that can't be read leaves ids
 * on show and adds a notice.
 */
export const useProgramInfo = (
    ids: ReadonlyArray<string> | undefined
): ProgramInfoResult => {
    const client = useTimelineClient()
    const queries = useQueries({
        queries: (ids ?? []).map((program) => ({
            queryKey: timelineKeys.programMetadata(program),
            staleTime: Infinity,
            queryFn: async ({ signal }: { signal: AbortSignal }) =>
                toProgramInfo(
                    unwrap(
                        await fetchProgramTimelineMetadata(
                            client,
                            { program },
                            signal
                        )
                    )
                ),
        })),
    })
    // Rebuilt only when an answer changes, so entries keep their references.
    const answered = queries.map((query) => query.dataUpdatedAt).join()
    const programs = useMemo(() => {
        const found = queries.flatMap((query) =>
            query.data === undefined ? [] : [query.data]
        )
        return found.length === 0
            ? NO_PROGRAMS
            : new Map(found.map((info) => [info.id, info]))
        // `answered` changes whenever any query's data does.
        // oxlint-disable-next-line react-hooks/exhaustive-deps
    }, [answered])
    const pendingIds = new Set(
        (ids ?? []).filter(
            (_, index) => statusOf(queries[index] ?? NOT_ASKED) === 'pending'
        )
    )
    return {
        programs,
        pending: ids === undefined || pendingIds.size > 0,
        pendingIds,
        isFetching: queries.some((query) => query.isFetching),
        notices: queries.flatMap((query, index) => {
            const program = ids?.[index]
            return statusOf(query) === 'error' && program !== undefined
                ? [
                      {
                          id: `metadata-failed:${program}`,
                          tone: 'warning' as const,
                          message: i18n.t(
                              "Details of program {{program}} couldn't load, so ids are shown.",
                              { program }
                          ),
                          retry: refetchOf(query),
                      },
                  ]
                : []
        }),
    }
}

const NO_NAMES: ReadonlyMap<string, string> = new Map()

/**
 * Names for org units, one request for the whole set. Waits for `ids`, so
 * entries never show an id that a name is about to replace. A new set keeps
 * the names already known on show while it loads.
 */
export const useOrgUnitNames = (ids: ReadonlyArray<string> | undefined) => {
    const client = useTimelineClient()
    const query = useQuery({
        queryKey: timelineKeys.orgUnitNames(ids ?? []),
        enabled: ids !== undefined && ids.length > 0,
        staleTime: Infinity,
        placeholderData: keepPreviousData,
        queryFn: async ({ signal }: { signal: AbortSignal }) =>
            new Map(
                unwrap(
                    await fetchOrgUnitNames(client, { ids: ids ?? [] }, signal)
                ).map(({ id, displayName }) => [id, displayName])
            ),
    })
    const status = statusOf(query)
    return {
        names: query.data ?? NO_NAMES,
        pending: ids === undefined || (ids.length > 0 && status === 'pending'),
        isFetching: query.isFetching,
        notices:
            status === 'error'
                ? [
                      {
                          id: 'org-units-failed',
                          tone: 'warning' as const,
                          message: i18n.t(
                              "Org unit names couldn't load, so ids are shown."
                          ),
                          retry: refetchOf(query),
                      },
                  ]
                : [],
    }
}
