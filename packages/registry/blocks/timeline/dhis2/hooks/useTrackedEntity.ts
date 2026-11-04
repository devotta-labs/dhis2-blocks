import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { trackedEntityQuery } from '../queryState'
import type { TrackedEntity } from '../schemas'
import { useTimelineClient } from './useTimelineClient'

/** The tracked entity and its enrollments in every program. */
export const useTrackedEntity = (
    trackedEntity: string
): UseQueryResult<TrackedEntity> => {
    const client = useTimelineClient()
    return useQuery(trackedEntityQuery(client, trackedEntity))
}
