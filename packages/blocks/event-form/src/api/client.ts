import { Result } from 'better-result'
import { z, type ZodType } from 'zod'

type DataEngineQueryParameters = Record<
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
    params?: DataEngineQueryParameters
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

/**
 * `request`: the engine rejected (network, HTTP status).
 * `invalid-response`: DHIS2 answered with a shape this block does not accept.
 * `not-found`: the response is valid but lacks what was asked for.
 */
export type EventFormApiErrorKind = 'request' | 'invalid-response' | 'not-found'

export class EventFormApiError extends Error {
    override readonly cause: unknown
    readonly kind: EventFormApiErrorKind
    readonly status: number | undefined

    constructor(
        kind: EventFormApiErrorKind,
        message: string,
        cause?: unknown,
        status?: number
    ) {
        super(message)
        this.name = 'EventFormApiError'
        this.kind = kind
        this.cause = cause
        this.status = status
    }
}

export interface EventFormClient {
    query<T>(
        request: ResourceRequest,
        schema: ZodType<T>,
        signal?: AbortSignal
    ): Promise<Result<T, EventFormApiError>>
    mutate(
        mutation: DataEngineMutation
    ): Promise<Result<unknown, EventFormApiError>>
}

const RequestFailureSchema = z.looseObject({
    status: z.number().optional(),
    response: z.looseObject({ status: z.number().optional() }).optional(),
    details: z
        .looseObject({ httpStatusCode: z.number().optional() })
        .optional(),
})

const getErrorStatus = (cause: unknown) => {
    const candidate = RequestFailureSchema.safeParse(cause)
    return candidate.success
        ? (candidate.data.status ??
              candidate.data.response?.status ??
              candidate.data.details?.httpStatusCode)
        : undefined
}

const describeCause = (cause: unknown) =>
    cause instanceof Error ? cause.message : String(cause)

const toRequestError = (context: string) => (cause: unknown) =>
    cause instanceof EventFormApiError
        ? cause
        : new EventFormApiError(
              'request',
              `${context}: ${describeCause(cause)}`,
              cause,
              getErrorStatus(cause)
          )

const RESOURCE_KEY = 'eventFormResource'

const QueryEnvelopeSchema = z.looseObject({ [RESOURCE_KEY]: z.unknown() })

export const createEventFormClient = (
    engine: DataEngineLike
): EventFormClient => ({
    async query<T>(
        request: ResourceRequest,
        schema: ZodType<T>,
        signal?: AbortSignal
    ) {
        const response = await Result.tryPromise({
            try: () =>
                engine.query(
                    { [RESOURCE_KEY]: request },
                    signal ? { signal } : undefined
                ),
            catch: toRequestError(`Request for ${request.resource} failed`),
        })
        return response.andThen((envelope) => {
            const parsed = QueryEnvelopeSchema.safeParse(envelope)
            const value = parsed.success
                ? schema.safeParse(parsed.data[RESOURCE_KEY])
                : parsed
            return value.success
                ? Result.ok(value.data)
                : Result.err(
                      new EventFormApiError(
                          'invalid-response',
                          `Unexpected ${request.resource} response: ${value.error.message}`,
                          value.error
                      )
                  )
        })
    },
    mutate(mutation: DataEngineMutation) {
        return Result.tryPromise({
            try: () => engine.mutate(mutation),
            catch: toRequestError(`Request to ${mutation.resource} failed`),
        })
    },
})

/**
 * Malformed responses and client errors are deterministic. Operational
 * failures are retried twice.
 */
export const shouldRetryEventFormRequest = (
    failureCount: number,
    cause: unknown
) => {
    if (failureCount >= 2) {
        return false
    }
    if (cause instanceof EventFormApiError) {
        if (cause.kind !== 'request') {
            return false
        }
        return cause.status === undefined || cause.status >= 500
    }
    return true
}
