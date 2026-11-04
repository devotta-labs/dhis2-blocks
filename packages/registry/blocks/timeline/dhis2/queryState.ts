import type { UseQueryResult } from '@tanstack/react-query'
import { Result } from 'better-result'
import type { TimelineStatus } from '../core/types'
import type { TimelineClient } from './client'
import { fetchTrackedEntity } from './queries'
import { timelineKeys } from './timelineKeys'
import type { ProgramInfo } from './types'

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
}): TimelineStatus => {
    if (query.data !== undefined) {
        return 'success'
    }
    return query.isError || query.errorUpdateCount > 0 ? 'error' : 'pending'
}

/** Refetches without cancelling a request already on its way for the same key. */
export const refetchOf = (query: Pick<UseQueryResult, 'refetch'>) => () =>
    void query.refetch({ cancelRefetch: false })

/** What the hooks read from a list of queries, one item per query. */
export interface QueriesSummary<T> {
    data: Array<T | undefined>
    statuses: TimelineStatus[]
    errors: Array<Error | null>
    isFetching: boolean
    retries: Array<() => void>
}

/**
 * The `combine` for `useQueries`. TanStack Query shares the parts of its
 * result that haven't changed, so `data` and `statuses` keep their
 * references until an answer or a status changes, and can be memo deps.
 */
export const summarize = <T>(
    queries: ReadonlyArray<UseQueryResult<T>>
): QueriesSummary<T> => ({
    data: queries.map((query) => query.data),
    statuses: queries.map(statusOf),
    errors: queries.map((query) => query.error),
    isFetching: queries.some((query) => query.isFetching),
    retries: queries.map(refetchOf),
})

/** The display name of a program for notices: its name once known, else its id. */
export const programLabel = (
    programs: ReadonlyMap<string, ProgramInfo>,
    id: string
) => programs.get(id)?.name ?? id

/** The query for one tracked entity and its enrollments, shared by the hooks that read it. */
export const trackedEntityQuery = (
    client: TimelineClient,
    trackedEntity: string
) => ({
    queryKey: timelineKeys.trackedEntity(trackedEntity),
    queryFn: async ({ signal }: { signal: AbortSignal }) =>
        unwrap(await fetchTrackedEntity(client, { trackedEntity }, signal)),
})
