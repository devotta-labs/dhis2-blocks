import { readFileSync } from 'node:fs'
import { z } from 'zod'
import {
    createRecordClient,
    httpStatusOf,
    isUnavailableResponse,
    RecordRequestError,
    type DataEngineLike,
    type DataEngineQuery,
} from '../client'

const ResourceSchema = z.looseObject({ id: z.string(), count: z.number() })

const engineResolving = (value: Awaited<ReturnType<DataEngineLike['query']>>) =>
    ({ query: async () => value }) satisfies DataEngineLike

const engineRejecting = (error: Error) =>
    ({
        query: async () => {
            throw error
        },
    }) satisfies DataEngineLike

const failureOf = async (error: Error) => {
    const result = await createRecordClient(engineRejecting(error)).query(
        { resource: 'tracker/trackedEntities', id: 'X' },
        ResourceSchema
    )
    if (result.isOk()) {
        throw new Error('expected an error result')
    }
    return result.error
}

describe('record client', () => {
    it('returns ok with the parsed resource', async () => {
        const result = await createRecordClient(
            engineResolving({
                recordResource: { id: 'abc', count: 2, extra: 'kept' },
            })
        ).query({ resource: 'anything' }, ResourceSchema)

        expect(result.isOk()).toBe(true)
        expect(result.isOk() && result.value).toEqual({
            id: 'abc',
            count: 2,
            extra: 'kept',
        })
    })

    it('sends the request under one key, with the abort signal', async () => {
        const queries: DataEngineQuery[] = []
        const signals: Array<AbortSignal | undefined> = []
        const engine: DataEngineLike = {
            query: async (query, options) => {
                queries.push(query)
                signals.push(options?.signal)
                return { recordResource: { id: 'a', count: 1 } }
            },
        }
        const controller = new AbortController()

        await createRecordClient(engine).query(
            { resource: 'me', params: { fields: 'id' } },
            ResourceSchema,
            controller.signal
        )

        expect(queries).toEqual([
            { recordResource: { resource: 'me', params: { fields: 'id' } } },
        ])
        expect(signals).toEqual([controller.signal])
    })

    it('wraps an engine rejection as http with the status from details.httpStatusCode', async () => {
        const error = await failureOf(
            Object.assign(new Error('Not Found'), {
                details: { httpStatusCode: 404, errorCode: 'E1005' },
            })
        )

        expect(error).toBeInstanceOf(RecordRequestError)
        expect(error.kind).toBe('http')
        expect(error.status).toBe(404)
    })

    it('reads the status through cause', async () => {
        const error = await failureOf(
            new Error('wrapped', {
                cause: Object.assign(new Error('inner'), {
                    details: { httpStatusCode: 403 },
                }),
            })
        )

        expect(error.kind).toBe('http')
        expect(error.status).toBe(403)
    })

    it('reads the status from a trailing (404) in the message', async () => {
        const error = await failureOf(new Error('Request failed (404)'))

        expect(error.kind).toBe('http')
        expect(error.status).toBe(404)
    })

    it('reads the status from the recorded missing-person answer', async () => {
        const recorded = z
            .object({ status: z.number(), body: z.looseObject({}) })
            .parse(
                JSON.parse(
                    readFileSync(
                        new URL(
                            './fixtures/v43/person-missing.status.json',
                            import.meta.url
                        ),
                        'utf8'
                    )
                )
            )
        const error = await failureOf(
            Object.assign(new Error('Not Found'), { details: recorded.body })
        )

        expect(error.status).toBe(recorded.status)
        expect(isUnavailableResponse(error)).toBe(true)
    })

    it('treats a rejection without a status as a network failure', async () => {
        const error = await failureOf(new TypeError('Failed to fetch'))

        expect(error.kind).toBe('network')
        expect(error.status).toBeUndefined()
    })

    it('marks a schema mismatch as invalid-response', async () => {
        const result = await createRecordClient(
            engineResolving({ recordResource: { id: 'abc' } })
        ).query({ resource: 'anything' }, ResourceSchema)

        expect(result.isErr() && result.error.kind).toBe('invalid-response')
    })

    it('marks a missing envelope key as invalid-response', async () => {
        const result = await createRecordClient(
            engineResolving({ wrongKey: { id: 'abc', count: 1 } })
        ).query({ resource: 'anything' }, ResourceSchema)

        expect(result.isErr() && result.error.kind).toBe('invalid-response')
    })

    it('returns unavailable only for 403, 404 and 409 http errors', () => {
        const http = (status: number) =>
            new RecordRequestError('http', 'failed', { status })

        for (const status of [403, 404, 409]) {
            expect(isUnavailableResponse(http(status))).toBe(true)
        }
        for (const status of [400, 401, 500, 502]) {
            expect(isUnavailableResponse(http(status))).toBe(false)
        }
        expect(
            isUnavailableResponse(new RecordRequestError('network', 'offline'))
        ).toBe(false)
        expect(
            isUnavailableResponse(
                new RecordRequestError('invalid-response', 'bad', {
                    status: 404,
                })
            )
        ).toBe(false)
    })
})

describe('httpStatusOf', () => {
    it('is undefined when nothing carries a status', () => {
        expect(httpStatusOf(new Error('boom'))).toBeUndefined()
    })

    it('ignores a number that is not a trailing status', () => {
        expect(httpStatusOf(new Error('Got (404) then more'))).toBeUndefined()
    })
})
