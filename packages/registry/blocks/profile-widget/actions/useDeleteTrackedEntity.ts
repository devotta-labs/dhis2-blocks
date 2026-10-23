import {
    useMutation,
    useQueryClient,
    type Query,
    type QueryClient,
    type QueryKey,
} from '@tanstack/react-query'
import { markQueryDeleted } from '../api/deletedQueries'
import { profileWidgetQueryKeys } from '../api/queryKeys'
import { useProfileWidgetClient } from '../api/runtime'
import type { UseDeleteTrackedEntityResult } from '../types'
import { deleteTrackedEntity } from './trackerImport'

/**
 * Removes every query under `queryKey` without letting a mounted observer
 * refetch it. Removing a query a component still renders makes that
 * component rebuild it on its next render and fetch the deleted entity again
 * (a 404). So every query is first marked deleted, which disables its
 * automatic fetches (mount, window focus, reconnect, invalidation) through
 * its `enabled` option, and any fetch in flight is cancelled. Unobserved
 * queries are removed now; a query that is still on screen keeps its last
 * data and is removed the moment its last observer unsubscribes, which is
 * when the host unmounts the profile or navigates away in `onSuccess`.
 */
const removeQueriesOnceUnobserved = async (
    queryClient: QueryClient,
    queryKey: QueryKey
) => {
    for (const query of queryClient.getQueryCache().findAll({ queryKey })) {
        markQueryDeleted(query)
    }
    await queryClient.cancelQueries({ queryKey })
    const queryCache = queryClient.getQueryCache()
    const observed = new Set<Query>()
    for (const query of queryCache.findAll({ queryKey })) {
        if (query.getObserversCount() > 0) {
            observed.add(query)
        } else {
            queryCache.remove(query)
        }
    }
    if (observed.size === 0) {
        return
    }

    const unsubscribe = queryCache.subscribe((event) => {
        if (!observed.has(event.query)) {
            return
        }
        if (event.type === 'removed') {
            observed.delete(event.query)
        } else if (
            event.type === 'observerRemoved' &&
            event.query.getObserversCount() === 0
        ) {
            observed.delete(event.query)
            queryCache.remove(event.query)
        }
        if (observed.size === 0) {
            unsubscribe()
        }
    })
}

/**
 * `POST tracker?async=false&importStrategy=DELETE`. On success, removes
 * `profileWidgetQueryKeys.trackedEntity(id)` (the record and every changelog
 * page) instead of invalidating it, because a refetch would answer 404. A
 * query that a mounted profile still shows keeps its last data until that
 * profile unmounts, and is removed then. It is never refetched in between,
 * not on window focus or reconnect either.
 *
 * `deleteTrackedEntity` never rejects: failures resolve to `Result.err` with a
 * `TrackerImportError` (tracker `errorReports`, e.g. a missing
 * `F_TEI_CASCADE_DELETE`) or a `ProfileWidgetRequestError`.
 */
export function useDeleteTrackedEntity(): UseDeleteTrackedEntityResult {
    const client = useProfileWidgetClient()
    const queryClient = useQueryClient()
    const { mutateAsync, isPending } = useMutation({
        mutationFn: async (trackedEntityId: string) => {
            const result = await deleteTrackedEntity(client, trackedEntityId)
            if (result.isOk()) {
                await removeQueriesOnceUnobserved(
                    queryClient,
                    profileWidgetQueryKeys.trackedEntity(trackedEntityId)
                )
            }
            return result
        },
    })

    return { deleteTrackedEntity: mutateAsync, isPending }
}
