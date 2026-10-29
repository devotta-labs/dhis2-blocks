import { useDataEngine } from '@dhis2/app-runtime'
import { useMemo } from 'react'
import { z } from 'zod'
import {
    createRelationshipViewerClient,
    type DataEngineLike,
    type DataEngineQuery,
    type DataEngineValue,
    type RelationshipViewerClient,
} from '../api/client'

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

export const useRuntimeRelationshipViewerClient =
    (): RelationshipViewerClient => {
        const engine = useDataEngine()
        return useMemo(() => {
            const adapted: DataEngineLike = {
                query: async (query, options) =>
                    EngineResultSchema.parse(
                        await engine.query(
                            // SAFETY: the adapter maps the structural Relationship Viewer query contract to app-runtime's equivalent data-query shape.
                            toRuntimeQuery(query) as Parameters<
                                typeof engine.query
                            >[0],
                            options
                        )
                    ),
            }
            return createRelationshipViewerClient(adapted)
        }, [engine])
    }
