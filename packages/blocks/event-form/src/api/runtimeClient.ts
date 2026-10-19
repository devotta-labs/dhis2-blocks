import { useDataEngine } from '@dhis2/app-runtime'
import { useMemo } from 'react'
import { z } from 'zod'
import {
    createEventFormClient,
    type DataEngineLike,
    type DataEngineMutation,
    type DataEngineQuery,
    type DataEngineValue,
    type EventFormClient,
} from './client'

const EngineValueSchema: z.ZodType<DataEngineValue> = z.lazy(() =>
    z.union([
        z.string(),
        z.number(),
        z.boolean(),
        z.null(),
        z.undefined(),
        z.array(EngineValueSchema),
        z.record(z.string(), EngineValueSchema),
    ])
)
const EngineResultSchema = z.record(z.string(), EngineValueSchema)
const MutationDataSchema = z.record(z.string(), z.json())

const toRuntimeQuery = (query: DataEngineQuery) =>
    Object.fromEntries(
        Object.entries(query).map(([key, definition]) => [
            key,
            {
                resource: definition.resource,
                id: definition.id,
                params: definition.params,
            },
        ])
    )

const toRuntimeMutation = (mutation: DataEngineMutation) => {
    if (mutation.type === 'delete') {
        if (!mutation.id) {
            throw new Error('A delete mutation requires an id')
        }
        return {
            resource: mutation.resource,
            id: mutation.id,
            type: 'delete' as const,
            params: mutation.params,
        }
    }
    const data = MutationDataSchema.parse(mutation.data)
    if (mutation.type === 'create') {
        return {
            resource: mutation.resource,
            type: 'create' as const,
            params: mutation.params,
            data,
        }
    }
    if (!mutation.id) {
        throw new Error(`${mutation.type} mutation requires an id`)
    }
    return {
        resource: mutation.resource,
        id: mutation.id,
        type: mutation.type,
        params: mutation.params,
        data,
    }
}

/** The event form client over the host app's app-runtime data engine. */
export const useEventFormClient = (): EventFormClient => {
    const engine = useDataEngine()
    return useMemo(() => {
        const adapter: DataEngineLike = {
            query: async (query, options) =>
                EngineResultSchema.parse(
                    await engine.query(
                        // SAFETY: the adapter maps the structural query contract to app-runtime's equivalent data-query shape.
                        toRuntimeQuery(query) as Parameters<
                            typeof engine.query
                        >[0],
                        options
                    )
                ),
            mutate: (mutation) =>
                engine.mutate(
                    // SAFETY: the adapter validates mutation data and required IDs before constructing an app-runtime mutation.
                    toRuntimeMutation(mutation) as Parameters<
                        typeof engine.mutate
                    >[0]
                ),
        }
        return createEventFormClient(adapter)
    }, [engine])
}
