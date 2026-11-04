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

type DataEngineValue =
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

/** Internal: runs one request and validates the response. */
export interface FinderResourceClient {
    query<T>(
        request: ResourceRequest,
        schema: ZodType<T>,
        signal?: AbortSignal
    ): Promise<T>
}

const CLIENT: unique symbol = Symbol('TrackedEntityFinderClient')

/**
 * An opaque handle for `<TrackedEntityFinder client>`. It cannot run
 * requests itself, so it is no way around the finder's search rules.
 */
export interface TrackedEntityFinderClient {
    readonly [CLIENT]: true
}

const resourceClients = new WeakMap<
    TrackedEntityFinderClient,
    FinderResourceClient
>()

/** A failed DHIS2 request, with the HTTP status and server message kept. */
export class FinderRequestError extends Error {
    readonly status?: number
    readonly serverMessage?: string
    override readonly cause: unknown

    constructor(
        message: string,
        cause: unknown,
        status?: number,
        serverMessage?: string
    ) {
        super(message)
        this.name = 'FinderRequestError'
        this.cause = cause
        if (status !== undefined) {
            this.status = status
        }
        if (serverMessage !== undefined) {
            this.serverMessage = serverMessage
        }
    }
}

/** `.catch` makes every field lenient: a malformed one loses only itself. */
const lenient = <T extends z.ZodType>(schema: T) =>
    schema.optional().catch(undefined)

const RequestFailureSchema = z.looseObject({
    message: lenient(z.string()),
    httpStatusCode: lenient(z.number()),
    status: lenient(z.number()),
    response: lenient(z.looseObject({ status: lenient(z.number()) })),
    details: lenient(
        z.looseObject({
            httpStatusCode: lenient(z.number()),
            message: lenient(z.string()),
        })
    ),
})

const isAbort = (cause: unknown) =>
    cause instanceof Error && cause.name === 'AbortError'

/** Each field is read on its own, so one malformed field loses only itself. */
const toRequestError = (cause: unknown): FinderRequestError => {
    const failure = RequestFailureSchema.safeParse(cause).data
    const status =
        failure?.details?.httpStatusCode ??
        failure?.httpStatusCode ??
        failure?.status ??
        failure?.response?.status
    const serverMessage = failure?.details?.message ?? failure?.message
    return new FinderRequestError(
        serverMessage ?? 'The DHIS2 request failed',
        cause,
        status,
        serverMessage
    )
}

/**
 * Malformed responses and client errors are deterministic. Operational
 * failures are retried twice so consumers keep React Query's resilience
 * without hiding malformed DHIS2 responses.
 */
export const shouldRetryFinderRequest = (
    failureCount: number,
    cause: unknown
) => {
    if (failureCount >= 2 || cause instanceof ZodError) {
        return false
    }
    const status =
        cause instanceof FinderRequestError
            ? cause.status
            : toRequestError(cause).status
    return status === undefined || status >= 500
}

const RESULT_KEY = 'trackedEntityFinderResource'

const QueryEnvelopeSchema = z
    .object({ [RESULT_KEY]: z.unknown() })
    .passthrough()

/** Internal: the request runner behind a finder client. */
export const createFinderResourceClient = (
    engine: DataEngineLike
): FinderResourceClient => ({
    async query<T>(
        request: ResourceRequest,
        schema: ZodType<T>,
        signal?: AbortSignal
    ) {
        let raw: Record<string, DataEngineValue>
        try {
            raw = await engine.query(
                { [RESULT_KEY]: request },
                signal ? { signal } : undefined
            )
        } catch (cause) {
            throw isAbort(cause) ? cause : toRequestError(cause)
        }
        const response = QueryEnvelopeSchema.parse(raw)
        return schema.parse(response[RESULT_KEY])
    },
})

/** A finder client for a custom data engine (the default is app-runtime's). */
export const createTrackedEntityFinderClient = (
    engine: DataEngineLike
): TrackedEntityFinderClient => {
    const client: TrackedEntityFinderClient = Object.freeze({
        [CLIENT]: true as const,
    })
    resourceClients.set(client, createFinderResourceClient(engine))
    return client
}

/** Internal: the request runner a finder client stands for. */
export const resourceClientOf = (
    client: TrackedEntityFinderClient
): FinderResourceClient => {
    const resourceClient = resourceClients.get(client)
    if (!resourceClient) {
        throw new Error(
            'Not a tracked entity finder client: create one with createTrackedEntityFinderClient'
        )
    }
    return resourceClient
}
