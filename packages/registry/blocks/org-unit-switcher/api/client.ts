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
export interface OrgUnitResourceClient {
    query<T>(
        request: ResourceRequest,
        schema: ZodType<T>,
        signal?: AbortSignal
    ): Promise<Result<T, Error>>
}

const CLIENT: unique symbol = Symbol('OrgUnitClient')

/**
 * An opaque handle for `<OrgUnitProvider client>`. It cannot run
 * requests itself, so it is no way around the provider's scope check.
 */
export interface OrgUnitClient {
    readonly [CLIENT]: true
}

const resourceClients = new WeakMap<OrgUnitClient, OrgUnitResourceClient>()

/** A failed DHIS2 request, with the HTTP status kept. */
class OrgUnitRequestError extends Error {
    readonly status?: number
    override readonly cause: unknown

    constructor(message: string, cause: unknown, status?: number) {
        super(message)
        this.name = 'OrgUnitRequestError'
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
    return new OrgUnitRequestError(
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
 * network failed. Malformed responses and client errors would fail the same
 * way again.
 */
export const shouldRetryOrgUnitRequest = (failureCount: number, cause: Error) =>
    failureCount < 2 &&
    cause instanceof OrgUnitRequestError &&
    (cause.status === undefined || cause.status >= 500)

const RESULT_KEY = 'orgUnitResource'

const QueryEnvelopeSchema = z
    .object({ [RESULT_KEY]: z.unknown() })
    .passthrough()

/**
 * Internal: the request runner behind an organisation unit client. Engine
 * failures (HTTP, network, abort) and schema failures both come back as
 * error results; nothing here throws.
 */
export const createOrgUnitResourceClient = (
    engine: DataEngineLike
): OrgUnitResourceClient => ({
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
const cacheIds = new WeakMap<OrgUnitClient, number>()
let lastCacheId = 0

const newClient = (engine: DataEngineLike, cacheId: number): OrgUnitClient => {
    const client: OrgUnitClient = Object.freeze({
        [CLIENT]: true as const,
    })
    resourceClients.set(client, createOrgUnitResourceClient(engine))
    cacheIds.set(client, cacheId)
    return client
}

/**
 * An organisation unit client for a custom data engine (the default is
 * app-runtime's). Create it once, outside render: each client caches its own
 * results.
 */
export const createOrgUnitClient = (engine: DataEngineLike): OrgUnitClient => {
    lastCacheId += 1
    return newClient(engine, lastCacheId)
}

/**
 * Internal: app-runtime's client. An app has one data engine, so its results
 * share cache id 0 however often the client is rebuilt.
 */
export const createRuntimeOrgUnitClient = (
    engine: DataEngineLike
): OrgUnitClient => newClient(engine, 0)

/** Internal: the client's part of every query key. */
export const cacheIdOf = (client: OrgUnitClient): number =>
    cacheIds.get(client) ?? 0

/** Internal: the request runner an organisation unit client stands for. */
export const resourceClientOf = (
    client: OrgUnitClient
): OrgUnitResourceClient => {
    const resourceClient = resourceClients.get(client)
    if (!resourceClient) {
        throw new Error(
            'Not an organisation unit client: create one with createOrgUnitClient'
        )
    }
    return resourceClient
}
