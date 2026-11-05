import { FetchError, useDataEngine } from '@dhis2/app-runtime'
import { useMemo } from 'react'
import { ZodError, type ZodType } from 'zod'

type QueryParameter = string | number | boolean | string[]

interface RuleResourceRequest {
    resource: string
    id?: string
    params?: Record<string, QueryParameter>
}

/** Runs app-runtime data queries and validates the response at the boundary. */
export interface ProgramRulesClient {
    query<T>(
        query: Record<string, RuleResourceRequest>,
        schema: ZodType<T>,
        signal?: AbortSignal
    ): Promise<T>
}

export const useProgramRulesClient = (): ProgramRulesClient => {
    const engine = useDataEngine()
    return useMemo(
        () => ({
            query: async (query, schema, signal) =>
                schema.parse(
                    await engine.query(
                        Object.fromEntries(
                            Object.entries(query).map(([key, request]) => [
                                key,
                                {
                                    resource: request.resource,
                                    id: request.id,
                                    params: request.params,
                                },
                            ])
                        ),
                        { signal }
                    )
                ),
        }),
        [engine]
    )
}

/** Malformed responses and client errors are deterministic; other failures get two retries. */
export const shouldRetryProgramRulesRequest = (
    failureCount: number,
    error: Error
): boolean => {
    if (failureCount >= 2 || error instanceof ZodError) {
        return false
    }
    if (error instanceof FetchError) {
        const status = error.details.httpStatusCode
        return (
            error.type !== 'access' && (status === undefined || status >= 500)
        )
    }
    return true
}
