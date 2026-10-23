import { z, ZodError, type ZodType } from 'zod'
import {
    ProfileWidgetInvalidResponseError,
    ProfileWidgetRequestError,
    TrackedEntityNotAccessibleError,
    TrackerImportError,
    type TrackerErrorReport,
} from '../errors'
import type { ProfileMutationError, ProfileWidgetLoadError } from '../types'
import type { TrackerImportPayload } from './schemas'

export type QueryParameters = Record<
    string,
    string | number | boolean | undefined
>

export interface ProfileWidgetQueryRequest {
    resource: string
    id?: string
    params?: QueryParameters
}

export interface ProfileWidgetMutationRequest {
    resource: 'tracker'
    type: 'create'
    params: QueryParameters
    data: TrackerImportPayload
}

export type DataEngineValue =
    | string
    | number
    | boolean
    | null
    | undefined
    | ReadonlyArray<DataEngineValue>
    | { [key: string]: DataEngineValue }

export interface DataEngineLike {
    query(
        query: Record<string, ProfileWidgetQueryRequest>,
        options?: { signal?: AbortSignal }
    ): Promise<Record<string, DataEngineValue>>
    mutate(mutation: ProfileWidgetMutationRequest): Promise<DataEngineValue>
}

export interface ProfileWidgetClient {
    query<T>(
        request: ProfileWidgetQueryRequest,
        schema: ZodType<T>,
        signal?: AbortSignal
    ): Promise<T>
    mutate<T>(
        request: ProfileWidgetMutationRequest,
        schema: ZodType<T>
    ): Promise<T>
}

const RESULT_KEY = 'profileWidgetResource'

const QueryEnvelopeSchema = z
    .object({ [RESULT_KEY]: z.unknown() })
    .passthrough()

export const createProfileWidgetClient = (
    engine: DataEngineLike
): ProfileWidgetClient => ({
    async query<T>(
        request: ProfileWidgetQueryRequest,
        schema: ZodType<T>,
        signal?: AbortSignal
    ) {
        const response = QueryEnvelopeSchema.parse(
            await engine.query(
                { [RESULT_KEY]: request },
                signal ? { signal } : undefined
            )
        )
        return schema.parse(response[RESULT_KEY])
    },
    async mutate<T>(request: ProfileWidgetMutationRequest, schema: ZodType<T>) {
        return schema.parse(await engine.mutate(request))
    },
})

const RequestFailureSchema = z
    .object({
        status: z.number().optional(),
        response: z.object({ status: z.number().optional() }).optional(),
        details: z
            .object({ httpStatusCode: z.number().optional() })
            .passthrough()
            .optional(),
    })
    .passthrough()

export const getRequestStatus = (cause: unknown): number | undefined => {
    const parsed = RequestFailureSchema.safeParse(cause)
    return parsed.success
        ? (parsed.data.status ??
              parsed.data.response?.status ??
              parsed.data.details?.httpStatusCode)
        : undefined
}

export const shouldRetryProfileWidgetRequest = (
    failureCount: number,
    cause: unknown
) => {
    if (
        failureCount >= 2 ||
        cause instanceof ZodError ||
        cause instanceof ProfileWidgetInvalidResponseError ||
        cause instanceof TrackedEntityNotAccessibleError ||
        cause instanceof TrackerImportError
    ) {
        return false
    }
    const status =
        cause instanceof ProfileWidgetRequestError
            ? cause.httpStatus
            : getRequestStatus(cause)
    return status === undefined || status >= 500
}

const describeFailure = (operation: string, status: number | undefined) =>
    status === undefined
        ? `${operation}: the request could not reach the server`
        : `${operation}: the server responded with status ${status}`

export const toProfileWidgetRequestError = (
    cause: unknown,
    operation: string
): ProfileWidgetRequestError => {
    if (cause instanceof ProfileWidgetRequestError) {
        return cause
    }
    if (
        cause instanceof ZodError ||
        cause instanceof ProfileWidgetInvalidResponseError
    ) {
        return new ProfileWidgetRequestError({
            operation,
            message: `${operation}: the server response failed boundary validation`,
            cause,
        })
    }
    const httpStatus = getRequestStatus(cause)
    return new ProfileWidgetRequestError({
        operation,
        message: describeFailure(operation, httpStatus),
        httpStatus,
        cause,
    })
}

export const toProfileWidgetLoadError = (
    cause: unknown,
    operation: string,
    trackedEntity?: { trackedEntityId: string; programId: string | null }
): ProfileWidgetLoadError => {
    if (
        cause instanceof TrackedEntityNotAccessibleError ||
        cause instanceof ProfileWidgetRequestError ||
        cause instanceof ProfileWidgetInvalidResponseError
    ) {
        return cause
    }
    if (cause instanceof ZodError) {
        return new ProfileWidgetInvalidResponseError({
            operation,
            message: `${operation}: the server response failed boundary validation`,
            cause,
        })
    }
    const httpStatus = getRequestStatus(cause)
    if (trackedEntity && (httpStatus === 403 || httpStatus === 404)) {
        return new TrackedEntityNotAccessibleError({
            ...trackedEntity,
            httpStatus,
            message: `${operation}: tracked entity ${trackedEntity.trackedEntityId} is not accessible (${httpStatus})`,
            cause,
        })
    }
    return new ProfileWidgetRequestError({
        operation,
        message: describeFailure(operation, httpStatus),
        httpStatus,
        cause,
    })
}

const ErrorReportsSchema = z
    .object({
        validationReport: z
            .object({
                errorReports: z.array(
                    z
                        .object({
                            message: z.string(),
                            errorCode: z.string().optional(),
                            trackerType: z.string().optional(),
                            uid: z.string().optional(),
                        })
                        .passthrough()
                ),
            })
            .passthrough(),
    })
    .passthrough()

const readTrackerErrorReports = (
    cause: unknown
): readonly TrackerErrorReport[] => {
    const direct = ErrorReportsSchema.safeParse(cause)
    if (direct.success) {
        return direct.data.validationReport.errorReports
    }
    const details = z
        .object({ details: z.unknown() })
        .passthrough()
        .safeParse(cause)
    if (details.success) {
        const nested = ErrorReportsSchema.safeParse(details.data.details)
        if (nested.success) {
            return nested.data.validationReport.errorReports
        }
    }
    return []
}

export const toProfileMutationError = (
    cause: unknown,
    operation: string
): ProfileMutationError => {
    if (
        cause instanceof TrackerImportError ||
        cause instanceof ProfileWidgetRequestError
    ) {
        return cause
    }
    const errorReports = readTrackerErrorReports(cause)
    if (errorReports.length > 0) {
        return new TrackerImportError({
            operation,
            message: `${operation}: the tracker import was rejected`,
            errorReports,
            cause,
        })
    }
    return toProfileWidgetRequestError(cause, operation)
}
