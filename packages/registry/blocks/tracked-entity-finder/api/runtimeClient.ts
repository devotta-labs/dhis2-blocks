import { useDataEngine } from '@dhis2/app-runtime'
import { useMemo } from 'react'
import {
    createTrackedEntityFinderClient,
    type DataEngineLike,
    type TrackedEntityFinderClient,
} from './client'

export const useTrackedEntityFinderClient = (): TrackedEntityFinderClient => {
    const engine = useDataEngine()
    return useMemo(
        () =>
            createTrackedEntityFinderClient({
                query: (query, options) =>
                    // SAFETY: the finder query is app-runtime's data-query shape, and the finder client validates every response with its schema.
                    engine.query(
                        query as Parameters<typeof engine.query>[0],
                        options
                    ) as ReturnType<DataEngineLike['query']>,
            }),
        [engine]
    )
}
