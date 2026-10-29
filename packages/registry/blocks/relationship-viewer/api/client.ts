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

export interface DataEngineLike {
    query(
        query: DataEngineQuery,
        options?: { signal?: AbortSignal }
    ): Promise<Record<string, DataEngineValue>>
}

export interface ResourceRequest {
    resource: string
    id?: string
    params?: DataEngineQueryParameters
}

export interface RelationshipViewerClient {
    query<T>(
        request: ResourceRequest,
        schema: ZodType<T>,
        signal?: AbortSignal
    ): Promise<T>
    /** One engine query holding several named resources; `schema` validates the whole response. */
    queryAll<T>(
        requests: Record<string, ResourceRequest>,
        schema: ZodType<T>,
        signal?: AbortSignal
    ): Promise<T>
}

/** A deterministic violation of a validated DHIS2/domain boundary. */
export class RelationshipViewerBoundaryError extends Error {
    override readonly cause: unknown

    constructor(message: string, cause?: unknown) {
        super(message)
        this.name = 'RelationshipViewerBoundaryError'
        this.cause = cause
    }
}

// Plain errors carry `status` / `response.status`; the app-runtime FetchError carries only
// `type`, `message` and `details` (the parsed response body).
const RequestFailureSchema = z
    .object({
        type: z.string().optional(),
        message: z.string().optional(),
        status: z.number().optional(),
        response: z.object({ status: z.number().optional() }).optional(),
        details: z.object({ httpStatusCode: z.number().optional() }).catch({}),
    })
    .passthrough()

// FetchError messages end in "(NNN)", e.g. "An unknown error occurred - Not Found (404)".
const MESSAGE_STATUS = /\((\d{3})\)$/

const getErrorStatus = (cause: unknown) => {
    const candidate = RequestFailureSchema.safeParse(cause)
    if (!candidate.success) {
        return undefined
    }
    const { status, response, details, message } = candidate.data
    const fromMessage = MESSAGE_STATUS.exec(message ?? '')?.[1]
    return (
        status ??
        response?.status ??
        details?.httpStatusCode ??
        (fromMessage ? Number(fromMessage) : undefined)
    )
}

const isAccessError = (cause: unknown) => {
    const candidate = RequestFailureSchema.safeParse(cause)
    return candidate.success && candidate.data.type === 'access'
}

/**
 * Boundary validation errors and client errors are deterministic. Operational
 * failures are retried twice so consumers retain React Query's resilience
 * without hiding malformed DHIS2 responses.
 */
export const shouldRetryRelationshipRequest = (
    failureCount: number,
    cause: unknown
) => {
    if (
        failureCount >= 2 ||
        cause instanceof ZodError ||
        cause instanceof RelationshipViewerBoundaryError ||
        isAccessError(cause)
    ) {
        return false
    }
    const status = getErrorStatus(cause)
    if (status !== undefined && status < 500) {
        return false
    }
    return true
}

const RESULT_KEY = 'relationshipViewerResource'

export const createRelationshipViewerClient = (
    engine: DataEngineLike
): RelationshipViewerClient => {
    const queryAll: RelationshipViewerClient['queryAll'] = async (
        requests,
        schema,
        signal
    ) =>
        schema.parse(
            await engine.query(requests, signal ? { signal } : undefined)
        )
    return {
        queryAll,
        async query(request, schema, signal) {
            const response = await queryAll(
                { [RESULT_KEY]: request },
                z.object({ [RESULT_KEY]: schema }),
                signal
            )
            return response[RESULT_KEY]
        },
    }
}
