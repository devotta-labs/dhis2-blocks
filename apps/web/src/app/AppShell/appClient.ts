import type { useDataEngine } from '@dhis2/app-runtime'
import type { ZodType } from 'zod'

export type AppEngine = Pick<ReturnType<typeof useDataEngine>, 'query'>

export interface AppResourceRequest {
    resource: string
    id?: string
    params?: Readonly<Record<string, string | number | boolean>>
}

/** Reads one DHIS2 resource and parses it, so the app only sees typed data. */
export const createAppClient = (engine: AppEngine) => ({
    async query<T>(
        request: AppResourceRequest,
        schema: ZodType<T>,
        signal?: AbortSignal
    ): Promise<T> {
        const response = await engine.query(
            { appResource: request },
            { signal }
        )
        return schema.parse(response.appResource)
    },
})

export type AppClient = ReturnType<typeof createAppClient>
