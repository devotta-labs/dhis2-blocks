import { useDataEngine } from '@dhis2/app-runtime'
import {
    createTrackedEntityFinderClient,
    type DataEngineLike,
    type TrackedEntityFinderClient,
} from './client'

const runtimeClients = new WeakMap<object, TrackedEntityFinderClient>()

export const useTrackedEntityFinderClient = (): TrackedEntityFinderClient => {
    const engine = useDataEngine()
    let client = runtimeClients.get(engine)
    if (!client) {
        client = createTrackedEntityFinderClient({
            query: (query, options) =>
                // SAFETY: the finder query is app-runtime's data-query shape, and the finder client validates every response with its schema.
                engine.query(
                    query as Parameters<typeof engine.query>[0],
                    options
                ) as ReturnType<DataEngineLike['query']>,
        })
        runtimeClients.set(engine, client)
    }
    return client
}
