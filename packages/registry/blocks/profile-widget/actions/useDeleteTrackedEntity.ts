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
