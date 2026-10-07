import { ZodError, z } from 'zod'
import { WorkingListBoundaryError } from '../api/client'
import {
    WorkingListInvalidResponseError,
    WorkingListNetworkError,
    WorkingListResultsError,
} from './errors'

const RequestFailureSchema = z
    .object({
        status: z.number().optional(),
        response: z.object({ status: z.number().optional() }).optional(),
        details: z.object({ httpStatusCode: z.number().optional() }).optional(),
    })
    .passthrough()

const getRequestErrorStatus = (cause: unknown) => {
    const parsed = RequestFailureSchema.safeParse(cause)

    return parsed.success
        ? (parsed.data.status ??
              parsed.data.response?.status ??
              parsed.data.details?.httpStatusCode)
        : undefined
}

export const toTransportError = (cause: unknown, operation: string) => {
    if (
        cause instanceof WorkingListNetworkError ||
        cause instanceof WorkingListInvalidResponseError
    ) {
        return cause
    }

    if (
        cause instanceof ZodError ||
        cause instanceof WorkingListBoundaryError
    ) {
        return new WorkingListInvalidResponseError({
            operation,
            message: `${operation}: the server response failed boundary validation`,
            cause,
        })
    }

    const status = getRequestErrorStatus(cause)

    return new WorkingListNetworkError({
        operation,
        message:
            status === undefined
                ? `${operation}: the request could not reach the server`
                : `${operation}: the server responded with status ${status}`,
        cause,
    })
}

export const toResultsError = (cause: unknown) =>
    new WorkingListResultsError({
        message: toTransportError(cause, 'Loading working-list results')
            .message,
        cause,
    })
