import { useDataEngine } from '@dhis2/app-runtime'
import { useMemo } from 'react'
import {
    createRuntimeObservationsClient,
    type DataEngineLike,
    type ObservationsClient,
} from './client'

export const useObservationsClient = (): ObservationsClient => {
    const engine = useDataEngine()
    return useMemo(
        () =>
            createRuntimeObservationsClient({
                query: (query, options) =>
                    // SAFETY: the observations query is app-runtime's data-query shape, and the client validates every response with its schema.
                    engine.query(
                        query as Parameters<typeof engine.query>[0],
                        options
                    ) as ReturnType<DataEngineLike['query']>,
            }),
        [engine]
    )
}
