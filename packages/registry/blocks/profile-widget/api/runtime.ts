/*
 * The app-runtime hooks behind the data, changelog and action hooks.
 * app-runtime reads `localStorage` when it is imported, so the plain modules
 * (api/client, api/serverVersion, api/requests, the lookups and the tracker
 * import functions) stay free of it and run in node tests with a fake engine.
 */
import { useConfig, useDataEngine } from '@dhis2/app-runtime'
import { useMemo } from 'react'
import { z } from 'zod'
import {
    createProfileWidgetClient,
    type DataEngineValue,
    type ProfileWidgetClient,
} from './client'
import {
    resolveServerFeatures,
    type ProfileServerFeatures,
} from './serverVersion'

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

/** The client bound to the app-runtime data engine of the current app. */
export const useProfileWidgetClient = (): ProfileWidgetClient => {
    const engine = useDataEngine()

    return useMemo(
        () =>
            createProfileWidgetClient({
                query: async (query, options) =>
                    EngineResultSchema.parse(
                        await engine.query(query, options)
                    ),
                mutate: async (mutation) =>
                    EngineValueSchema.parse(
                        await engine.mutate({
                            resource: mutation.resource,
                            type: mutation.type,
                            params: mutation.params,
                            data: mutation.data,
                        })
                    ),
            }),
        [engine]
    )
}

/** Reads `useConfig().serverVersion` (falling back to `apiVersion`). */
export const useProfileServerFeatures = (): ProfileServerFeatures => {
    const { apiVersion, serverVersion } = useConfig()
    const major = serverVersion?.major
    const minor = serverVersion?.minor

    return useMemo(
        () =>
            resolveServerFeatures({
                apiVersion,
                serverVersion:
                    major === undefined || minor === undefined
                        ? undefined
                        : { major, minor },
            }),
        [apiVersion, major, minor]
    )
}
