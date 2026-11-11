import { useDataEngine } from '@dhis2/app-runtime'
import { useMemo } from 'react'
import {
    createTrackedEntityFinderClient,
    type DataEngineLike,
    type TrackedEntityFinderClient,
} from './client'

const clients = new WeakMap<
    ReturnType<typeof useDataEngine>,
    TrackedEntityFinderClient
>()

export const useTrackedEntityFinderClient = (): TrackedEntityFinderClient => {
    const engine = useDataEngine()
    return useMemo(() => {
        const existing = clients.get(engine)
        if (existing) return existing
        const client = createTrackedEntityFinderClient({
            query: (query, options) =>
                // SAFETY: the finder query is app-runtime's data-query shape, and the finder client validates every response with its schema.
                engine.query(
                    query as Parameters<typeof engine.query>[0],
                    options
                ) as ReturnType<DataEngineLike['query']>,
        })
        clients.set(engine, client)
        return client
    }, [engine])
}
