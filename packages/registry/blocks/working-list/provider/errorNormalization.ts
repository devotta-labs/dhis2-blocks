import { ZodError } from 'zod'
import { WorkingListBoundaryError } from '../api/client'
import { getRequestErrorStatus } from '../api/httpStatus'
import {
    WorkingListInvalidResponseError,
    WorkingListNetworkError,
    WorkingListResultsError,
} from './errors'

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
