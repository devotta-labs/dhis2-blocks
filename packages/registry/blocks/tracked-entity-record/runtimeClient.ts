import { useDataEngine } from '@dhis2/app-runtime'
import { useMemo } from 'react'
import { z } from 'zod'
import {
    createRecordClient,
    type DataEngineQuery,
    type DataEngineValue,
    type RecordClient,
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

/** The record client over the app's data engine, stable for one engine. */
export const useRecordClient = (): RecordClient => {
    const engine = useDataEngine()
    return useMemo(
        () =>
            createRecordClient({
                query: async (query, options) =>
                    EngineResultSchema.parse(
                        await engine.query(
                            // SAFETY: the structural query type matches app-runtime's data-query type; the adapter copies only resource, id and params.
                            toRuntimeQuery(query) as Parameters<
                                typeof engine.query
                            >[0],
                            options
                        )
                    ),
            }),
        [engine]
    )
}
