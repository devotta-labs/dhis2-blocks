import { Result } from 'better-result'
import { z, type ZodType } from 'zod'

type DataEngineQueryParameters = Record<
    string,
    string | number | boolean | undefined | ReadonlyArray<string | number>
>

export interface ResourceRequest {
    resource: string
    id?: string
    params?: DataEngineQueryParameters
}

export type DataEngineQuery = Record<string, ResourceRequest>

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

interface QueryOptions {
    signal?: AbortSignal
}

/** The slice of the app-runtime data engine the block uses: read-only. */
export interface DataEngineLike {
    query(
        query: DataEngineQuery,
        options?: QueryOptions
    ): Promise<Record<string, DataEngineValue>>
}

export type RecordRequestErrorKind = 'http' | 'network' | 'invalid-response'

interface RecordRequestErrorOptions {
    status?: number
    cause?: unknown
}

/** A failed request: what the server answered, or why no answer was usable. */
export class RecordRequestError extends Error {
    readonly kind: RecordRequestErrorKind
    readonly status?: number

    constructor(
        kind: RecordRequestErrorKind,
        message: string,
        options: RecordRequestErrorOptions = {}
    ) {
        super(message, { cause: options.cause })
        this.name = 'RecordRequestError'
        this.kind = kind
        this.status = options.status
    }
}

export interface RecordClient {
    query<T>(
        request: ResourceRequest,
        schema: ZodType<T>,
        signal?: AbortSignal
    ): Promise<Result<T, RecordRequestError>>
}

const UNAVAILABLE_STATUSES: ReadonlySet<number> = new Set([403, 404, 409])

/**
 * Spec 7.1: the server's own "this person is not there for you" answers.
 * Anything else (network, 5xx, 400, a response the schema rejects) is an
 * error, not an absence. A 401 is an ended session, not an answer about the
 * person, so it is an error too.
 */
export const isUnavailableResponse = (error: RecordRequestError) =>
    error.kind === 'http' &&
    error.status !== undefined &&
    UNAVAILABLE_STATUSES.has(error.status)

const StatusDetailsSchema = z.looseObject({
    details: z.looseObject({ httpStatusCode: z.number() }),
})

const TRAILING_STATUS = /\((\d{3})\)\s*$/u
const MAX_CAUSE_DEPTH = 5

/**
 * The HTTP status an engine rejection carries: `details.httpStatusCode` on the
 * error or anything in its `cause` chain, else a trailing `(NNN)` in the
 * message of a FetchError.
 */
export const httpStatusOf = (error: Error): number | undefined => {
    let current: Error | undefined = error
    for (let depth = 0; current && depth < MAX_CAUSE_DEPTH; depth += 1) {
        const details = StatusDetailsSchema.safeParse(current)
        if (details.success) {
            return details.data.details.httpStatusCode
        }
        current = current.cause instanceof Error ? current.cause : undefined
    }
    const trailing = TRAILING_STATUS.exec(error.message)
    return trailing ? Number(trailing[1]) : undefined
}

const RESULT_KEY = 'recordResource'

const toError = (cause: unknown) =>
    cause instanceof Error ? cause : new Error(String(cause))

const requestErrorFor = (cause: unknown) => {
    const error = toError(cause)
    const status = httpStatusOf(error)
    return status === undefined
        ? new RecordRequestError('network', error.message, { cause: error })
        : new RecordRequestError('http', error.message, {
              status,
              cause: error,
          })
}

export const createRecordClient = (engine: DataEngineLike): RecordClient => ({
    async query<T>(
        request: ResourceRequest,
        schema: ZodType<T>,
        signal?: AbortSignal
    ) {
        let response: Record<string, DataEngineValue>
        try {
            response = await engine.query(
                { [RESULT_KEY]: request },
                signal ? { signal } : undefined
            )
        } catch (cause) {
            return Result.err(requestErrorFor(cause))
        }
        const parsed = schema.safeParse(response[RESULT_KEY])
        if (!parsed.success) {
            return Result.err(
                new RecordRequestError(
                    'invalid-response',
                    `Unexpected response from ${request.resource}: ${parsed.error.message}`,
                    { cause: parsed.error }
                )
            )
        }
        return Result.ok(parsed.data)
    },
})
