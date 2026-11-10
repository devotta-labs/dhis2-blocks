import { useDataEngine } from '@dhis2/app-runtime'
import { useMemo } from 'react'
import {
    createRuntimeTrackedEntityHeaderClient,
    type DataEngineLike,
    type TrackedEntityHeaderClient,
} from './client'

export const useTrackedEntityHeaderClient = (): TrackedEntityHeaderClient => {
    const engine = useDataEngine()
    return useMemo(
        () =>
            createRuntimeTrackedEntityHeaderClient({
                query: (query, options) =>
                    // SAFETY: the tracked entity header query is app-runtime's data-query shape, and the client validates every response with its schema.
                    engine.query(
                        query as Parameters<typeof engine.query>[0],
                        options
                    ) as ReturnType<DataEngineLike['query']>,
            }),
        [engine]
    )
}
