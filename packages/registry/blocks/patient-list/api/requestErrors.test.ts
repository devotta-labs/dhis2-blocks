import { z } from 'zod'
import {
    PatientListRequestError,
    shouldRetryPatientListRequest,
    toRequestError,
} from './requestErrors'

const zodError = () => {
    const result = z.string().safeParse(1)
    if (result.success) throw new Error('Expected a parse failure')
    return result.error
}

type Json = string | number | boolean | null | Json[] | { [key: string]: Json }

const failure = (fields: Record<string, Json>) =>
    Object.assign(new Error('Request failed'), fields)

describe('toRequestError', () => {
    it('keeps the status and server message from the details', () => {
        const cause = failure({
            details: { httpStatusCode: 409, message: 'No access to program' },
        })
        const error = toRequestError(cause)
        expect(error).toBeInstanceOf(PatientListRequestError)
        expect(error).toMatchObject({
            name: 'PatientListRequestError',
            status: 409,
            serverMessage: 'No access to program',
            message: 'No access to program',
            cause,
        })
    })

    it('reads the status from the top level or the response', () => {
        expect(toRequestError(failure({ httpStatusCode: 400 }))).toMatchObject({
            status: 400,
        })
        expect(toRequestError(failure({ status: 503 }))).toMatchObject({
            status: 503,
        })
        expect(
            toRequestError(failure({ response: { status: 404 } }))
        ).toMatchObject({ status: 404 })
    })

    it('falls back to the error message, and a generic one', () => {
        expect(toRequestError(new Error('Network down'))).toMatchObject({
            serverMessage: 'Network down',
            status: undefined,
        })
        const error = toRequestError('nonsense')
        expect(error.message).toBe('The DHIS2 request failed')
        expect(error).toMatchObject({ serverMessage: undefined })
    })

    it('loses only a malformed field', () => {
        expect(
            toRequestError(
                failure({
                    details: { httpStatusCode: 'bad', message: 'Kept' },
                    httpStatusCode: 500,
                })
            )
        ).toMatchObject({ status: 500, serverMessage: 'Kept' })
    })

    it('passes Zod errors, its own errors and aborts through', () => {
        const parse = zodError()
        expect(toRequestError(parse)).toBe(parse)
        const own = new PatientListRequestError('x', undefined, 400)
        expect(toRequestError(own)).toBe(own)
        const abort = new DOMException('Aborted', 'AbortError')
        expect(toRequestError(abort)).toBe(abort)
    })
})

describe('shouldRetryPatientListRequest', () => {
    it('never retries a malformed response', () => {
        expect(shouldRetryPatientListRequest(0, zodError())).toBe(false)
    })

    it('never retries a client error', () => {
        expect(
            shouldRetryPatientListRequest(
                0,
                failure({ details: { httpStatusCode: 400 } })
            )
        ).toBe(false)
        expect(
            shouldRetryPatientListRequest(0, failure({ httpStatusCode: 404 }))
        ).toBe(false)
    })

    it('retries server and network failures at most twice', () => {
        const server = failure({ httpStatusCode: 502 })
        expect(shouldRetryPatientListRequest(0, server)).toBe(true)
        expect(shouldRetryPatientListRequest(1, server)).toBe(true)
        expect(shouldRetryPatientListRequest(2, server)).toBe(false)
        const network = new Error('Failed to fetch')
        expect(shouldRetryPatientListRequest(0, network)).toBe(true)
        expect(shouldRetryPatientListRequest(2, network)).toBe(false)
    })
})
