import { useQuery } from '@tanstack/react-query'
import { trackedEntityQuery } from '../queryState'
import { useTimelineClient } from './useTimelineClient'

/** The tracked entity and its enrollments in every program. */
export const useTrackedEntity = (trackedEntity: string) => {
    const client = useTimelineClient()
    return useQuery(trackedEntityQuery(client, trackedEntity))
}
