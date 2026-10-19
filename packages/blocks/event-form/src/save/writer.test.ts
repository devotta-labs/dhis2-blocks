import { Result } from 'better-result'
import { z } from 'zod'
import {
    createEventFormClient,
    type DataEngineLike,
    type DataEngineMutation,
} from '../api/client'
import { buildEventPayload } from './payload'
import { createOnlineEventWriter } from './writer'

const payload = buildEventPayload({
    eventId: 'Evahwp3zrQ4',
    programId: 'WSGAb5XwJ3Y',
    programStageId: 'WZbXY0S00lP',
    enrollmentId: 'PE6abx7Zhn0',
    status: 'ACTIVE',
    context: { occurredAt: '2026-03-12', orgUnitId: 'm7fBMpmVpSM' },
    effective: { de0FEHSIoxh: 'OLD_CODE', vANAXwtLwcT: '20' },
    initialStored: {},
    isNew: true,
})

type ErrorReportFixture = {
    message: string
    errorCode?: string
    trackerType?: string
    uid?: string
    args?: string[]
}

type ErrorDetails = {
    httpStatus?: string
    httpStatusCode?: number
    status?: string
    message?: string
    response?: {
        status?: string
        validationReport?: { errorReports: ErrorReportFixture[] }
    }
}

/** The shape app-runtime's FetchError has: `details` holds the response body. */
const fetchError = (
    type: 'access' | 'unknown' | 'network',
    message: string,
    details: ErrorDetails | Error
) => Object.assign(new Error(message), { type, details })

const writerFor = (mutate: DataEngineLike['mutate']) => {
    const calls: DataEngineMutation[] = []
    const engine: DataEngineLike = {
        query: async () => ({}),
        mutate: async (mutation) => {
            calls.push(mutation)
            return mutate(mutation)
        },
    }
    return {
        calls,
        write: createOnlineEventWriter(createEventFormClient(engine)),
    }
}

const rejecting = (error: Error): DataEngineLike['mutate'] => {
    return () => Promise.reject(error)
}

describe('online event writer', () => {
    it('posts to /tracker with create-and-update, object-level atomicity and sync', async () => {
        const { calls, write } = writerFor(async () => ({
            status: 'OK',
            stats: { created: 1, updated: 0, deleted: 0, ignored: 0, total: 1 },
        }))
        const result = await write(payload)
        expect(result).toEqual(Result.ok({ outcome: 'saved' }))
        expect(calls).toEqual([
            {
                resource: 'tracker',
                type: 'create',
                params: {
                    importStrategy: 'CREATE_AND_UPDATE',
                    atomicMode: 'OBJECT',
                    async: false,
                },
                data: payload,
            },
        ])
    })

    it('treats a 200 whose import report is an ERROR as a validation failure', async () => {
        const { write } = writerFor(async () => ({
            status: 'ERROR',
            validationReport: {
                errorReports: [
                    {
                        message: 'nope',
                        args: ['de0FEHSIoxh'],
                        uid: 'Evahwp3zrQ4',
                    },
                ],
            },
        }))
        const result = await write(payload)
        expect(result.isErr() && result.error).toEqual({
            kind: 'validation',
            fieldErrors: { de0FEHSIoxh: 'nope' },
            formErrors: [],
        })
    })

    it('treats a 200 with status OK but error reports as a validation failure', async () => {
        const { write } = writerFor(async () => ({
            status: 'OK',
            stats: { created: 0, updated: 0, deleted: 0, ignored: 1, total: 1 },
            validationReport: {
                errorReports: [
                    {
                        message: 'Value OLD_CODE is not a valid option',
                        args: ['de0FEHSIoxh'],
                        uid: 'Evahwp3zrQ4',
                    },
                    { message: 'about the event', uid: 'Evahwp3zrQ4' },
                ],
            },
        }))
        const result = await write(payload)
        expect(result.isErr() && result.error).toEqual({
            kind: 'validation',
            fieldErrors: {
                de0FEHSIoxh: 'Value OLD_CODE is not a valid option',
            },
            formErrors: ['about the event'],
        })
    })

    it('finds the report of a 200 under response', async () => {
        const { write } = writerFor(async () => ({
            httpStatus: 'OK',
            response: {
                status: 'WARNING',
                validationReport: {
                    errorReports: [
                        { message: 'nested', args: ['de0FEHSIoxh'] },
                    ],
                },
            },
        }))
        const result = await write(payload)
        expect(result.isErr() && result.error).toMatchObject({
            kind: 'validation',
            fieldErrors: { de0FEHSIoxh: 'nested' },
        })
    })

    it('treats a 200 with status ERROR and no validation report as unknown', async () => {
        const { write } = writerFor(async () => ({
            status: 'ERROR',
            message: 'Import blew up',
            stats: { created: 0, updated: 0, deleted: 0, ignored: 0, total: 0 },
        }))
        const result = await write(payload)
        expect(result.isErr() && result.error).toEqual({
            kind: 'unknown',
            message: 'Import blew up',
        })
    })

    it('treats a 200 with an ignored event and no reports as unknown', async () => {
        const { write } = writerFor(async () => ({
            status: 'OK',
            stats: { created: 0, updated: 0, deleted: 0, ignored: 1, total: 1 },
        }))
        const result = await write(payload)
        expect(result.isErr() && result.error).toEqual({
            kind: 'unknown',
            message: expect.stringContaining('1 ignored'),
        })
    })

    it('treats a 200 with a warning and nothing ignored as saved', async () => {
        const { write } = writerFor(async () => ({
            status: 'WARNING',
            stats: { created: 1, updated: 0, deleted: 0, ignored: 0, total: 1 },
            validationReport: { errorReports: [], warningReports: [{}] },
        }))
        const result = await write(payload)
        expect(result).toEqual(Result.ok({ outcome: 'saved' }))
    })

    it('maps a 409 with an errorReport naming a data element to a field error', async () => {
        const { write } = writerFor(
            rejecting(
                fetchError('access', 'Import failed', {
                    httpStatus: 'Conflict',
                    httpStatusCode: 409,
                    status: 'ERROR',
                    message: 'Import failed',
                    response: {
                        status: 'ERROR',
                        validationReport: {
                            errorReports: [
                                {
                                    message:
                                        "Value 'OLD_CODE' is not a valid option",
                                    errorCode: 'E1125',
                                    trackerType: 'EVENT',
                                    uid: 'Evahwp3zrQ4',
                                    args: ['OLD_CODE', 'de0FEHSIoxh'],
                                },
                                {
                                    message: 'Event date is in the future',
                                    errorCode: 'E1030',
                                    trackerType: 'EVENT',
                                    uid: 'Evahwp3zrQ4',
                                    args: ['2030-01-01'],
                                },
                            ],
                        },
                    },
                })
            )
        )
        const result = await write(payload)
        expect(result.isErr() && result.error).toEqual({
            kind: 'validation',
            fieldErrors: {
                de0FEHSIoxh: "Value 'OLD_CODE' is not a valid option",
            },
            formErrors: ['Event date is in the future'],
        })
    })

    it('maps a retired option code named only in the message', async () => {
        const { write } = writerFor(
            rejecting(
                fetchError('access', 'Import failed', {
                    httpStatusCode: 409,
                    response: {
                        validationReport: {
                            errorReports: [
                                {
                                    message:
                                        'Value OLD_CODE is not a valid option for DataElement de0FEHSIoxh',
                                    uid: 'Evahwp3zrQ4',
                                },
                            ],
                        },
                    },
                })
            )
        )
        const result = await write(payload)
        expect(result.isErr() && result.error).toMatchObject({
            kind: 'validation',
            fieldErrors: {
                de0FEHSIoxh:
                    'Value OLD_CODE is not a valid option for DataElement de0FEHSIoxh',
            },
            formErrors: [],
        })
    })

    it('keeps a 409 with no usable report as a validation error carrying the server message', async () => {
        const { write } = writerFor(
            rejecting(
                fetchError('access', 'Conflict happened', {
                    httpStatusCode: 409,
                    message: 'Conflict happened',
                })
            )
        )
        const result = await write(payload)
        expect(result.isErr() && result.error).toEqual({
            kind: 'validation',
            fieldErrors: {},
            formErrors: ['Conflict happened'],
        })
    })

    it('maps other HTTP errors to unknown with the server message', async () => {
        const { write } = writerFor(
            rejecting(
                fetchError('unknown', 'An unknown error occurred - (500)', {
                    httpStatusCode: 500,
                    message: 'Database is on fire',
                })
            )
        )
        const result = await write(payload)
        expect(result.isErr() && result.error).toEqual({
            kind: 'unknown',
            message: 'Database is on fire',
        })
    })

    it('maps a 403 without a body message to unknown', async () => {
        const { write } = writerFor(
            rejecting(fetchError('access', 'Forbidden', {}))
        )
        const result = await write(payload)
        expect(result.isErr() && result.error).toEqual({
            kind: 'unknown',
            message: 'Forbidden',
        })
    })

    it('maps a failure that is not app-runtime network error to unknown, so it is not retried as one', async () => {
        // app-runtime wraps a rejected fetch in a FetchError of type network (below); anything
        // else without an HTTP status is a fault here, which a retry or an outbox cannot fix.
        const invalid = z.object({ events: z.array(z.string()) }).safeParse({})
        const { write } = writerFor(rejecting(invalid.error ?? new Error()))
        const result = await write(payload)
        expect(result.isErr() && result.error.kind).toBe('unknown')

        const thrown = writerFor(rejecting(new TypeError('x is undefined')))
        const typeError = await thrown.write(payload)
        expect(typeError.isErr() && typeError.error).toEqual({
            kind: 'unknown',
            message: expect.stringContaining('x is undefined'),
        })
    })

    it('maps an app-runtime network FetchError to network', async () => {
        const { write } = writerFor(
            rejecting(
                fetchError(
                    'network',
                    'An unknown network error occurred',
                    new TypeError('Failed to fetch')
                )
            )
        )
        const result = await write(payload)
        expect(result.isErr() && result.error).toEqual({
            kind: 'network',
            message: expect.stringContaining('network'),
        })
    })
})
