import { useMemo } from 'react'
import {
    personQuery,
    programsQuery,
    relationshipsQuery,
    trackedEntityTypeQuery,
} from './queries'
import { useRecordClient } from './runtimeClient'

/**
 * Spec 6: the provider's own query options, bound to the app's data engine,
 * so a view can read a slice of the same cache entry with `select`. They
 * carry the server's answer only: program state comes from the record.
 */
export const useTrackedEntityRecordQueries = () => {
    const client = useRecordClient()
    return useMemo(
        () => ({
            person: (trackedEntityId: string) =>
                personQuery(client, trackedEntityId),
            relationships: (trackedEntityId: string) =>
                relationshipsQuery(client, trackedEntityId),
            programs: (programIds: ReadonlyArray<string>) =>
                programsQuery(client, programIds),
            trackedEntityType: (id: string) =>
                trackedEntityTypeQuery(client, id),
        }),
        [client]
    )
}
