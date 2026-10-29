import type { Query, QueryKey } from '@tanstack/react-query'

type CachedQuery<
    TQueryFnData,
    TError,
    TData,
    TQueryKey extends QueryKey,
> = Query<TQueryFnData, TError, TData, TQueryKey>

const deletedQueries = new WeakSet<object>()

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

export const isQueryNotDeleted = <
    TQueryFnData,
    TError,
    TData,
    TQueryKey extends QueryKey,
>(
    query: CachedQuery<TQueryFnData, TError, TData, TQueryKey>
) => !deletedQueries.has(query)
