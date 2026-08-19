import { z, ZodError, type ZodType } from 'zod'

export type DataEngineQueryParameters = Record<
    string,
    string | number | boolean | undefined | ReadonlyArray<string | number>
>

export interface DataEngineQueryDefinition {
    resource: string
    id?: string
    params?: DataEngineQueryParameters
}

export type DataEngineQuery = Record<string, DataEngineQueryDefinition>

export interface DataEngineMutation {
    resource: string
    id?: string
    type: 'create' | 'update' | 'replace' | 'delete'
    data?: unknown
}

export interface DataEngineLike {
    query(
        query: DataEngineQuery,
        options?: { signal?: AbortSignal }
    ): Promise<Record<string, unknown>>
    mutate(mutation: DataEngineMutation): Promise<unknown>
}

export interface ResourceRequest {
    resource: string
    id?: string
    params?: DataEngineQueryParameters
}

export interface WorkingListClient {
    query<T>(
        request: ResourceRequest,
        schema: ZodType<T>,
        signal?: AbortSignal
    ): Promise<T>
    mutate<T>(mutation: DataEngineMutation, schema: ZodType<T>): Promise<T>
}

/** A deterministic violation of a validated DHIS2/domain boundary. */
export class WorkingListBoundaryError extends Error {
    override readonly cause: unknown

    constructor(message: string, cause?: unknown) {
        super(message)
        this.name = 'WorkingListBoundaryError'
        this.cause = cause
    }
}

export const asWorkingListBoundaryError = (error: unknown, context: string) => {
    if (error instanceof WorkingListBoundaryError) {
        return error
    }
    const detail = error instanceof Error ? error.message : String(error)
    return new WorkingListBoundaryError(`${context}: ${detail}`, error)
}

const getErrorStatus = (error: unknown) => {
    if (!error || typeof error !== 'object') {
        return undefined
    }
    const candidate = error as {
        status?: number
        response?: { status?: number }
    }
    return candidate.status ?? candidate.response?.status
}

/**
 * Boundary validation errors and client errors are deterministic. Operational
 * failures are retried twice so consumers retain React Query's resilience
 * without hiding malformed DHIS2 responses.
 */
export const shouldRetryWorkingListRequest = (
    failureCount: number,
    error: unknown
) => {
    if (
        failureCount >= 2 ||
        error instanceof ZodError ||
        error instanceof WorkingListBoundaryError
    ) {
        return false
    }
    const status = getErrorStatus(error)
    if (status !== undefined && status < 500) {
        return false
    }
    return true
}

const RESULT_KEY = 'workingListResource'

const QueryEnvelopeSchema = z
    .object({ [RESULT_KEY]: z.unknown() })
    .passthrough()

export const createWorkingListClient = (
    engine: DataEngineLike
): WorkingListClient => ({
    async query<T>(
        request: ResourceRequest,
        schema: ZodType<T>,
        signal?: AbortSignal
    ) {
        const response = QueryEnvelopeSchema.parse(
            await engine.query(
                { [RESULT_KEY]: request },
                signal ? { signal } : undefined
            )
        )
        return schema.parse(response[RESULT_KEY])
    },
    async mutate<T>(mutation: DataEngineMutation, schema: ZodType<T>) {
        const response = await engine.mutate(mutation)
        return schema.parse(response)
    },
})
