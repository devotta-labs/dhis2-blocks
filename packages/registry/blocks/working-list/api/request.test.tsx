import { FetchError } from '@dhis2/app-runtime'
import { ZodError } from 'zod'
import {
    shouldRetryWorkingListRequest,
    WorkingListBoundaryError,
} from './request'

const failure = (httpStatusCode: number) =>
    new FetchError({
        type: 'unknown',
        message: `${httpStatusCode}`,
        details: { httpStatusCode },
    })

describe('shouldRetryWorkingListRequest', () => {
    it('does not retry deterministic boundary or client failures', () => {
        expect(shouldRetryWorkingListRequest(0, new ZodError([]))).toBe(false)
        expect(
            shouldRetryWorkingListRequest(
                0,
                new WorkingListBoundaryError('malformed')
            )
        ).toBe(false)
        expect(shouldRetryWorkingListRequest(0, failure(404))).toBe(false)
        expect(
            shouldRetryWorkingListRequest(
                0,
                new FetchError({
                    type: 'access',
                    message: 'Forbidden',
                    details: { httpStatusCode: 403 },
                })
            )
        ).toBe(false)
    })

    it('retries server and network failures twice', () => {
        expect(shouldRetryWorkingListRequest(0, failure(503))).toBe(true)
        expect(
            shouldRetryWorkingListRequest(
                1,
                new FetchError({ type: 'network', message: 'Offline' })
            )
        ).toBe(true)
        expect(shouldRetryWorkingListRequest(2, failure(503))).toBe(false)
    })
})
