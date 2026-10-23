import { useDataEngine } from '@dhis2/app-runtime'
import { useMemo } from 'react'
import { z } from 'zod'
import {
    createTrackedEntityFinderClient,
    type DataEngineLike,
    type DataEngineQuery,
    type TrackedEntityFinderClient,
} from './client'

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

export const useTrackedEntityFinderClient = (): TrackedEntityFinderClient => {
    const engine = useDataEngine()
    return useMemo(
        () =>
            createTrackedEntityFinderClient({
                query: async (query, options) =>
                    EngineResultSchema.parse(
                        await engine.query(
                            // SAFETY: the adapter maps the structural finder query contract to app-runtime's equivalent data-query shape.
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
