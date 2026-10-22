import { useQueryClient, type QueryKey } from '@tanstack/react-query'
import { useCallback, useSyncExternalStore } from 'react'

/**
 * A number that changes each time the query settles again, for a source's
 * `revision`. The first settle (success or error) is not a change, so it
 * returns `undefined` until the query has settled twice; after that it is the
 * count of settles. A counter, not a timestamp, so refetches that settle in
 * the same millisecond still differ. The query must be observed elsewhere
 * (`useQuery`) for invalidation to refetch it.
 */
export const useQueryRevision = (queryKey: QueryKey): number | undefined => {
    const queryClient = useQueryClient()

    const subscribe = useCallback(
        (onChange: () => void) =>
            queryClient.getQueryCache().subscribe(onChange),
        [queryClient]
    )
    const getSnapshot = () => {
        const state = queryClient.getQueryState(queryKey)
        return state ? state.dataUpdateCount + state.errorUpdateCount : 0
    }
    const settled = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

    return settled > 1 ? settled : undefined
}
