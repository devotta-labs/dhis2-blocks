import { useDataEngine } from '@dhis2/app-runtime'
import { useMemo } from 'react'
import {
    createRuntimeOrgUnitClient,
    type DataEngineLike,
    type OrgUnitClient,
} from './client'

export const useOrgUnitClient = (): OrgUnitClient => {
    const engine = useDataEngine()
    return useMemo(
        () =>
            createRuntimeOrgUnitClient({
                query: (query, options) =>
                    // SAFETY: the organisation unit query is app-runtime's data-query shape, and the client validates every response with its schema.
                    engine.query(
                        query as Parameters<typeof engine.query>[0],
                        options
                    ) as ReturnType<DataEngineLike['query']>,
            }),
        [engine]
    )
}
