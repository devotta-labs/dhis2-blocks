import type { useDataEngine } from '@dhis2/app-runtime'
import {
    createWorkingListClient,
    type DataEngineLike,
    type DataEngineMutation,
    type DataEngineQuery,
} from '@dhis2-blocks/working-list/development'
import { z } from 'zod'

type WorkingListEngineValue = Awaited<
    ReturnType<DataEngineLike['query']>
>[string]

const DataEngineValueSchema: z.ZodType<WorkingListEngineValue> = z.lazy(() =>
    z.union([
        z.string(),
        z.number(),
        z.boolean(),
        z.null(),
        z.undefined(),
        z.array(DataEngineValueSchema),
        z.record(z.string(), DataEngineValueSchema),
    ])
)
const DataEngineResultSchema = z.record(z.string(), DataEngineValueSchema)
const MutationDataSchema = z.record(z.string(), z.json())
const RuntimeQueryParameterSchema = z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.undefined(),
    z.array(z.union([z.string(), z.number()])),
])

const toRuntimeQuery = (query: DataEngineQuery) =>
    Object.fromEntries(
        Object.entries(query).map(([key, definition]) => {
            const params = definition.params
                ? Object.fromEntries(
                      Object.entries(definition.params).map(
                          ([parameter, value]) => [
                              parameter,
                              RuntimeQueryParameterSchema.parse(value),
                          ]
                      )
                  )
                : undefined
            return [
                key,
                {
                    resource: definition.resource,
                    id: definition.id,
                    params,
                },
            ]
        })
    )

const toRuntimeMutation = (mutation: DataEngineMutation) => {
    if (mutation.type === 'delete') {
        if (!mutation.id) {
            throw new Error('A delete mutation requires an id')
        }
        return {
            resource: mutation.resource,
            id: mutation.id,
            type: mutation.type,
        } as const
    }
    const data = MutationDataSchema.parse(mutation.data)
    if (mutation.type === 'create') {
        return {
            resource: mutation.resource,
            type: mutation.type,
            data,
        } as const
    }
    if (!mutation.id) {
        throw new Error(`${mutation.type} mutation requires an id`)
    }
    return {
        resource: mutation.resource,
        id: mutation.id,
        type: mutation.type,
        data,
    } as const
}

export const createAppWorkingListClient = (
    engine: ReturnType<typeof useDataEngine>
) => {
    const dataEngine: DataEngineLike = {
        query: async (query, options) =>
            DataEngineResultSchema.parse(
                await engine.query(toRuntimeQuery(query), options)
            ),
        mutate: (mutation) => engine.mutate(toRuntimeMutation(mutation)),
    }
    return createWorkingListClient(dataEngine)
}
