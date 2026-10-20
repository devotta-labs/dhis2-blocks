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

export interface ObservationsClient {
    query<T>(
        request: ResourceRequest,
        schema: ZodType<T>,
        signal?: AbortSignal
    ): Promise<Result<T, Error>>
}

const RESULT_KEY = 'observationsResource'

const QueryEnvelopeSchema = z
    .object({ [RESULT_KEY]: z.unknown() })
    .passthrough()

const toError = (cause: unknown, context: string) => {
    const detail = cause instanceof Error ? cause.message : String(cause)
    return new Error(`${context}: ${detail}`, { cause })
}

/**
 * Engine failures (HTTP, network, abort) and schema failures both come back
 * as error results; nothing here throws.
 */
export const createObservationsClient = (
    engine: DataEngineLike
): ObservationsClient => ({
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
