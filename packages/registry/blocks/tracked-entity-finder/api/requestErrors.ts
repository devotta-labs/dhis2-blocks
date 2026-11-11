import { z, ZodError } from 'zod'

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

/** Each field is read on its own, so one malformed field loses only itself. */
export const toRequestError = (cause: unknown): Error => {
    if (
        cause instanceof ZodError ||
        cause instanceof FinderRequestError ||
        (cause instanceof Error && cause.name === 'AbortError')
    ) {
        return cause
    }
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
    const error = toRequestError(cause)
    const status =
        error instanceof FinderRequestError ? error.status : undefined
    return status === undefined || status >= 500
}
