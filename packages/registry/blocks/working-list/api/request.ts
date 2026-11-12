import { FetchError, type useDataEngine } from '@dhis2/app-runtime'

/** app-runtime does not export the engine's type by name. */
export type DataEngine = ReturnType<typeof useDataEngine>

export type DataEngineQueryParameters = Record<
    string,
    string | number | boolean | undefined | Array<string | number>
>

/** One resource read, as the request serializers build it. */
export interface ResourceRequest {
    resource: string
    id?: string
    params?: DataEngineQueryParameters
}

/** A response that parsed as JSON but breaks a DHIS2 or domain rule. */
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

/**
 * Only a failed request is retried, twice, and only when the server or the
 * network failed. A malformed response and a client error would fail the
 * same way again.
 */
export const shouldRetryWorkingListRequest = (
    failureCount: number,
    error: Error
) =>
    failureCount < 2 &&
    error instanceof FetchError &&
    error.type !== 'access' &&
    (error.details.httpStatusCode === undefined ||
        error.details.httpStatusCode >= 500)
