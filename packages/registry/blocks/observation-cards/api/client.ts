import { Result } from 'better-result'
import { z, type ZodType } from 'zod'

type DataEngineQueryParameters = Record<string, string | number | boolean>

export interface ResourceRequest {
    resource: string
    id?: string
    params?: DataEngineQueryParameters
}

type DataEngineQuery = Record<string, ResourceRequest>

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

/** The read-only slice of the app-runtime data engine this block uses. */
export interface DataEngineLike {
    query(
        query: DataEngineQuery,
        options?: { signal?: AbortSignal }
    ): Promise<Record<string, DataEngineValue>>
}

/** Internal: runs one request and validates the response. */
export interface ObservationsResourceClient {
    query<T>(
        request: ResourceRequest,
        schema: ZodType<T>,
        signal?: AbortSignal
    ): Promise<Result<T, Error>>
}

const CLIENT: unique symbol = Symbol('ObservationsClient')

/**
 * An opaque handle for `<ObservationsProvider client>`. It cannot run
 * requests itself, so it is no way around the cards' data rules.
 */
export interface ObservationsClient {
    readonly [CLIENT]: true
}

const resourceClients = new WeakMap<
    ObservationsClient,
    ObservationsResourceClient
>()

/** A failed DHIS2 request, with the HTTP status kept. */
class ObservationsRequestError extends Error {
    readonly status?: number
    override readonly cause: unknown

    constructor(message: string, cause: unknown, status?: number) {
        super(message)
        this.name = 'ObservationsRequestError'
        this.cause = cause
        if (status !== undefined) {
            this.status = status
        }
    }
}

/** `.catch` makes every field lenient: a malformed one loses only itself. */
const lenient = <T extends z.ZodType>(schema: T) =>
    schema.optional().catch(undefined)

const RequestFailureSchema = z.looseObject({
    httpStatusCode: lenient(z.number()),
    status: lenient(z.number()),
    response: lenient(z.looseObject({ status: lenient(z.number()) })),
    details: lenient(z.looseObject({ httpStatusCode: lenient(z.number()) })),
})

const detailOf = (cause: unknown) =>
    cause instanceof Error ? cause.message : String(cause)

const toRequestError = (cause: unknown, resource: string) => {
    const failure = RequestFailureSchema.safeParse(cause).data
    return new ObservationsRequestError(
        `Request to ${resource} failed: ${detailOf(cause)}`,
        cause,
        failure?.details?.httpStatusCode ??
            failure?.httpStatusCode ??
            failure?.status ??
            failure?.response?.status
    )
}

/**
 * Only failed requests are retried, twice, and only when the server or the
 * network failed. Malformed responses, client errors and the data rules'
 * own errors (no enrollment, too many events) would fail the same way again.
 */
export const shouldRetryObservationsRequest = (
    failureCount: number,
    cause: Error
) =>
    failureCount < 2 &&
    cause instanceof ObservationsRequestError &&
    (cause.status === undefined || cause.status >= 500)

const RESULT_KEY = 'observationsResource'

const QueryEnvelopeSchema = z
    .object({ [RESULT_KEY]: z.unknown() })
    .passthrough()

/**
 * Internal: the request runner behind an observations client. Engine
 * failures (HTTP, network, abort) and schema failures both come back as
 * error results; nothing here throws.
 */
export const createObservationsResourceClient = (
    engine: DataEngineLike
): ObservationsResourceClient => ({
    async query<T>(
        request: ResourceRequest,
        schema: ZodType<T>,
        signal?: AbortSignal
    ) {
        const response = await Result.tryPromise({
            try: () =>
                engine.query(
                    { [RESULT_KEY]: request },
                    signal ? { signal } : undefined
                ),
            catch: (cause) => toRequestError(cause, request.resource),
        })
        return response.andThen((body) => {
            const envelope = QueryEnvelopeSchema.safeParse(body)
            if (!envelope.success) {
                return Result.err(
                    new Error(
                        `Unexpected engine response: ${envelope.error.message}`,
                        { cause: envelope.error }
                    )
                )
            }
            const parsed = schema.safeParse(envelope.data[RESULT_KEY])
            return parsed.success
                ? Result.ok(parsed.data)
                : Result.err(
                      new Error(
                          `Invalid ${request.resource} response: ${parsed.error.message}`,
                          { cause: parsed.error }
                      )
                  )
        })
    },
})

/** Each client's place in the query cache, so two engines never share results. */
const cacheIds = new WeakMap<ObservationsClient, number>()
let lastCacheId = 0

const newClient = (
    engine: DataEngineLike,
    cacheId: number
): ObservationsClient => {
    const client: ObservationsClient = Object.freeze({
        [CLIENT]: true as const,
    })
    resourceClients.set(client, createObservationsResourceClient(engine))
    cacheIds.set(client, cacheId)
    return client
}

/**
 * An observations client for a custom data engine (the default is
 * app-runtime's). Create it once, outside render: each client caches its own
 * results.
 */
export const createObservationsClient = (
    engine: DataEngineLike
): ObservationsClient => {
    lastCacheId += 1
    return newClient(engine, lastCacheId)
}

/** Internal: the client's part of every query key. */
export const cacheIdOf = (client: ObservationsClient): number =>
    cacheIds.get(client) ?? 0

/** Internal: the request runner an observations client stands for. */
export const resourceClientOf = (
    client: ObservationsClient
): ObservationsResourceClient => {
    const resourceClient = resourceClients.get(client)
    if (!resourceClient) {
        throw new Error(
            'Not an observations client: create one with createObservationsClient'
        )
    }
    return resourceClient
}
