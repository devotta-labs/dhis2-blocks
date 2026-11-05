import { QueryClient } from '@tanstack/react-query'
import { ZodError } from 'zod'
import { getRequestErrorStatus } from './httpStatus'
import {
    shouldRetryWorkingListRequest,
    WorkingListBoundaryError,
} from './client'
import {
    toTransportError,
    toResultsError,
} from '../provider/errorNormalization'
import {
    WorkingListInvalidResponseError,
    WorkingListNetworkError,
} from '../provider/errors'

describe('transport status decoding', () => {
    it.each([
        [
            {
                status: 401,
                response: { status: 503 },
                details: { httpStatusCode: 502 },
            },
            401,
        ],
        [{ response: { status: 403 }, details: { httpStatusCode: 502 } }, 403],
        [{ details: { httpStatusCode: 404 } }, 404],
        [{ status: 503 }, 503],
        [{ response: { status: 502 } }, 502],
        [{ details: { httpStatusCode: 500 } }, 500],
        [{ status: '404' }, undefined],
        [{ status: 404, response: null }, undefined],
        [null, undefined],
        [new Error('offline'), undefined],
    ] as const)(
        'uses the same supported status for retries and messages: %j',
        (cause, status) => {
            expect(getRequestErrorStatus(cause)).toBe(status)
            const error = toTransportError(cause, 'Loading metadata')
            expect(error).toBeInstanceOf(WorkingListNetworkError)
            expect(error.cause).toBe(cause)
            expect(error.message).toBe(
                status === undefined
                    ? 'Loading metadata: the request could not reach the server'
                    : `Loading metadata: the server responded with status ${status}`
            )
            expect(shouldRetryWorkingListRequest(0, cause)).toBe(
                status === undefined || status >= 500
            )
            expect(shouldRetryWorkingListRequest(2, cause)).toBe(false)
            expect(toResultsError(cause).cause).toBe(cause)
        }
    )

    it.each([new ZodError([]), new WorkingListBoundaryError('invalid')])(
        'preserves deterministic boundary causes and tags without retries',
        async (cause) => {
            const error = toTransportError(cause, 'Loading')
            expect(error).toBeInstanceOf(WorkingListInvalidResponseError)
            expect(error.cause).toBe(cause)
            expect(toTransportError(error, 'Another operation')).toBe(error)
            const queryFn = vi.fn().mockRejectedValue(cause)
            const client = new QueryClient()
            await expect(
                client.fetchQuery({
                    queryKey: ['boundary'],
                    queryFn,
                    retry: shouldRetryWorkingListRequest,
                    retryDelay: 0,
                })
            ).rejects.toBe(cause)
            expect(queryFn).toHaveBeenCalledTimes(1)
            client.clear()
        }
    )

    it('caps operational retries at two and retains an already normalized transport error', async () => {
        const cause = { details: { httpStatusCode: 503 } }
        const queryFn = vi.fn().mockRejectedValue(cause)
        const client = new QueryClient()
        await expect(
            client.fetchQuery({
                queryKey: ['network'],
                queryFn,
                retry: shouldRetryWorkingListRequest,
                retryDelay: 0,
            })
        ).rejects.toBe(cause)
        expect(queryFn).toHaveBeenCalledTimes(3)
        const error = toTransportError(cause, 'Loading')
        expect(toTransportError(error, 'Another operation')).toBe(error)
        client.clear()
    })
})
