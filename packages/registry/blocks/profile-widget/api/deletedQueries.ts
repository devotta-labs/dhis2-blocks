/*
 * Queries of a deleted tracked entity that a mounted component still renders.
 * They keep their last data until their last observer unsubscribes (see
 * actions/useDeleteTrackedEntity), but must never fetch again: the server
 * would answer 404. A function-valued `enabled` is resolved each time TanStack
 * decides whether to fetch (mount, window focus, reconnect, invalidation,
 * refetchInterval), so marking a query stops all of those without waiting for
 * a re-render. A query rebuilt later under the same key is a new object and
 * starts out enabled.
 */
import type { Query, QueryKey } from '@tanstack/react-query'

// Any query of the cache, whatever its data type.
type CachedQuery<
    TQueryFnData,
    TError,
    TData,
    TQueryKey extends QueryKey,
> = Query<TQueryFnData, TError, TData, TQueryKey>

const deletedQueries = new WeakSet<object>()

/** Stops every automatic fetch of `query`. */
export const markQueryDeleted = <
    TQueryFnData,
    TError,
    TData,
    TQueryKey extends QueryKey,
>(
    query: CachedQuery<TQueryFnData, TError, TData, TQueryKey>
) => {
    deletedQueries.add(query)
}

/** `enabled` for the record and changelog queries of one tracked entity. */
export const isQueryNotDeleted = <
    TQueryFnData,
    TError,
    TData,
    TQueryKey extends QueryKey,
>(
    query: CachedQuery<TQueryFnData, TError, TData, TQueryKey>
) => !deletedQueries.has(query)
