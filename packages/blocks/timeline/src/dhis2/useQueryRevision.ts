import { hashKey, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { useCallback, useState, useSyncExternalStore } from 'react'

/**
 * A number that changes each time the query's data is updated after it first
 * settled, for a source's `revision`; `undefined` until then. An update is a
 * successful fetch (a refetch after invalidation) or a `setQueryData` call.
 * The first settle, success or error, is not a change, and neither is a
 * failed fetch: a source that restarted on each failure would fail again and
 * restart again for as long as the endpoint stays down. A counter, not a
 * timestamp, so updates that land in the same millisecond still differ. The
 * query must be observed elsewhere (`useQuery`) for invalidation to refetch it.
 */
export const useQueryRevision = (queryKey: QueryKey): number | undefined => {
    const queryClient = useQueryClient()

    const read = () => {
        const state = queryClient.getQueryState(queryKey)
        return {
            data: state?.dataUpdateCount ?? 0,
            settled:
                (state?.dataUpdateCount ?? 0) + (state?.errorUpdateCount ?? 0) >
                0,
        }
    }

    const subscribe = useCallback(
        (onChange: () => void) =>
            queryClient.getQueryCache().subscribe(onChange),
        [queryClient]
    )
    const getSnapshot = () => {
        const { data, settled } = read()
        return `${data}:${settled}`
    }
    useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

    const { data, settled } = read()
    const hash = hashKey(queryKey)

    // The data count when the query first settled (for this key). Kept in
    // state and set during render, React's pattern for state derived from
    // props, so no ref is written while rendering.
    const [baseline, setBaseline] = useState<{
        hash: string
        at: number | undefined
    }>({ hash, at: settled ? data : undefined })
    let at = baseline.hash === hash ? baseline.at : undefined
    if (at === undefined && settled) {
        at = data
    }
    if (baseline.hash !== hash || baseline.at !== at) {
        setBaseline({ hash, at })
    }

    const revision = at === undefined ? 0 : data - at
    return revision > 0 ? revision : undefined
}
