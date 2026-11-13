import { useDataEngine } from '@dhis2/app-runtime'
import { useMemo } from 'react'
import {
    createRuntimeClinicClient,
    type DataEngineLike,
    type ClinicClient,
} from './client'

export const useClinicClient = (): ClinicClient => {
    const engine = useDataEngine()
    return useMemo(
        () =>
            createRuntimeClinicClient({
                query: (query, options) =>
                    // SAFETY: the clinic query is app-runtime's data-query shape, and the client validates every response with its schema.
                    engine.query(
                        query as Parameters<typeof engine.query>[0],
                        options
                    ) as ReturnType<DataEngineLike['query']>,
            }),
        [engine]
    )
}
