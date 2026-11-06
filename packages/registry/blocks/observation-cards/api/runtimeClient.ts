import { useDataEngine } from '@dhis2/app-runtime'
import {
    createObservationsClient,
    type DataEngineLike,
    type ObservationsClient,
} from './client'

const runtimeClients = new WeakMap<object, ObservationsClient>()

export const useObservationsClient = (): ObservationsClient => {
    const engine = useDataEngine()
    let client = runtimeClients.get(engine)
    if (!client) {
        client = createObservationsClient({
            query: (query, options) =>
                // SAFETY: the observations query is app-runtime's data-query shape, and the client validates every response with its schema.
                engine.query(
                    query as Parameters<typeof engine.query>[0],
                    options
                ) as ReturnType<DataEngineLike['query']>,
        })
        runtimeClients.set(engine, client)
    }
    return client
}
