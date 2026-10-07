import { z, ZodError, type ZodType } from 'zod'

export type DataEngineQueryParameters = Record<
    string,
    string | number | boolean | undefined | ReadonlyArray<string | number>
>

interface DataEngineQueryDefinition {
    resource: string
    id?: string
    params?: DataEngineQueryParameters
}

export type DataEngineQuery = Record<string, DataEngineQueryDefinition>

interface DataEngineResourceResponse {
    [key: string]: DataEngineValue
}

export type DataEngineValue =
    | string
    | number
    | boolean
    | null
    | undefined
    | ReadonlyArray<DataEngineValue>
    | DataEngineResourceResponse

type DataEngineMutationPayload =
    | string
    | number
    | boolean
    | null
    | undefined
    | object

export interface DataEngineMutation {
    resource: string
    id?: string
    type: 'create' | 'update' | 'replace' | 'delete'
    data?: DataEngineMutationPayload
}

export interface DataEngineLike {
    query(
        query: DataEngineQuery,
        options?: { signal?: AbortSignal }
    ): Promise<Record<string, DataEngineValue>>
    mutate(mutation: DataEngineMutation): Promise<DataEngineMutationPayload>
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

export const asWorkingListBoundaryError = (cause: unknown, context: string) => {
    if (cause instanceof WorkingListBoundaryError) {
        return cause
    }

    const detail = cause instanceof Error ? cause.message : String(cause)

    return new WorkingListBoundaryError(`${context}: ${detail}`, cause)
}

const RequestFailureSchema = z
    .object({
        status: z.number().optional(),
        response: z.object({ status: z.number().optional() }).optional(),
    })
    .passthrough()

const getErrorStatus = (cause: unknown) => {
    const candidate = RequestFailureSchema.safeParse(cause)

    return candidate.success
        ? (candidate.data.status ?? candidate.data.response?.status)
        : undefined
}

/**
 * Boundary validation errors and client errors are deterministic. Operational
 * failures are retried twice so consumers retain React Query's resilience
 * without hiding malformed DHIS2 responses.
 */
export const shouldRetryWorkingListRequest = (
    failureCount: number,
    cause: unknown
) => {
    if (
        failureCount >= 2 ||
        cause instanceof ZodError ||
        cause instanceof WorkingListBoundaryError
    ) {
        return false
    }

    const status = getErrorStatus(cause)

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
