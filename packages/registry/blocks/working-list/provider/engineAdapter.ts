import { useDataEngine } from '@dhis2/app-runtime'
import { useMemo } from 'react'
import { z } from 'zod'
import {
    createWorkingListClient,
    type DataEngineLike,
    type DataEngineMutation,
    type DataEngineQuery,
    type WorkingListClient,
} from '../api/client'

type EngineValue = Awaited<ReturnType<DataEngineLike['query']>>[string]

const EngineValueSchema: z.ZodType<EngineValue> = z.lazy(() =>
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
        }
    }
    const data = MutationDataSchema.parse(mutation.data)
    if (mutation.type === 'create') {
        return { resource: mutation.resource, type: 'create' as const, data }
    }
    if (!mutation.id) {
        throw new Error(`${mutation.type} mutation requires an id`)
    }
    return {
        resource: mutation.resource,
        id: mutation.id,
        type: mutation.type,
        data,
    }
}

export const useRuntimeWorkingListClient = (): WorkingListClient => {
    const engine = useDataEngine()
    return useMemo(
        () =>
            createWorkingListClient({
                query: async (query, options) =>
                    EngineResultSchema.parse(
                        await engine.query(
                            // SAFETY: the adapter maps the structural Working List query contract to app-runtime's equivalent data-query shape.
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
            }),
        [engine]
    )
}
