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

export interface TimelineClient {
    query<T>(
        request: ResourceRequest,
        schema: ZodType<T>,
        signal?: AbortSignal
    ): Promise<Result<T, Error>>
}

const RESULT_KEY = 'timelineResource'

const QueryEnvelopeSchema = z
    .object({ [RESULT_KEY]: z.unknown() })
    .passthrough()

const toError = (cause: unknown, context: string) => {
    const detail = cause instanceof Error ? cause.message : String(cause)
    return new Error(`${context}: ${detail}`, { cause })
}

const StatusDetailsSchema = z.object({
    details: z.object({ httpStatusCode: z.number().int() }),
})

/**
 * The HTTP status of a failed request, if the engine reported one: the
 * app-runtime FetchError carries the DHIS2 JSON body (`httpStatusCode`) in
 * `details`, and ends its message with `(<status>)` when the body wasn't JSON.
 * Looks through `cause`, where this client keeps the engine's error.
 */
export const httpStatusOf = (error: Error): number | undefined => {
    for (let at: unknown = error, depth = 0; at && depth < 5; depth++) {
        const parsed = StatusDetailsSchema.safeParse(at)
        if (parsed.success) {
            return parsed.data.details.httpStatusCode
        }
        if (at instanceof Error && 'details' in at) {
            const status = /\((\d{3})\)$/.exec(at.message)?.[1]
            return status === undefined ? undefined : Number(status)
        }
        at = at instanceof Error ? at.cause : undefined
    }
    return undefined
}

/**
 * Engine failures (HTTP, network, abort) and schema failures both come back
 * as error results; nothing here throws.
 */
export const createTimelineClient = (
    engine: DataEngineLike
): TimelineClient => ({
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
            catch: (cause) =>
                toError(cause, `Request to ${request.resource} failed`),
        })
        return response.andThen((body) => {
            const envelope = QueryEnvelopeSchema.safeParse(body)
            if (!envelope.success) {
                return Result.err(
                    toError(envelope.error, 'Unexpected engine response')
                )
            }
            const parsed = schema.safeParse(envelope.data[RESULT_KEY])
            return parsed.success
                ? Result.ok(parsed.data)
                : Result.err(
                      toError(
                          parsed.error,
                          `Invalid ${request.resource} response`
                      )
                  )
        })
    },
})
