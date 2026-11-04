import { Result } from 'better-result'
import { z } from 'zod'
import { createTimelineClient, httpStatusOf } from './client'

/** Shaped like app-runtime's FetchError for a 404 with a DHIS2 JSON body. */
const notFound = () =>
    Object.assign(new Error('An unknown error occurred - Not Found (404)'), {
        type: 'unknown',
        details: {
            httpStatus: 'Not Found',
            httpStatusCode: 404,
            status: 'ERROR',
        },
    })

const failingWith = async (cause: unknown) => {
    const client = createTimelineClient({
        query: () => Promise.reject(cause),
    })
    const result = await client.query({ resource: 'r' }, z.unknown())
    if (!Result.isError(result)) throw new Error('expected an error')
    return result.error
}

describe('httpStatusOf', () => {
    it('reads the HTTP status of a failed engine request', async () => {
        expect(httpStatusOf(await failingWith(notFound()))).toBe(404)
    })

    it('reads the status from the message when the body was not JSON', async () => {
        const error = Object.assign(
            new Error('An unknown error occurred - Not Found (404)'),
            { type: 'unknown', details: {} }
        )
        expect(httpStatusOf(await failingWith(error))).toBe(404)
    })

    it('has no status for network and schema failures', async () => {
        expect(
            httpStatusOf(
                await failingWith(
                    Object.assign(
                        new Error('An unknown network error occurred'),
                        { type: 'network', details: new TypeError('x') }
                    )
                )
            )
        ).toBeUndefined()

        const client = createTimelineClient({
            query: async () => ({ timelineResource: 'not a number' }),
        })
        const result = await client.query({ resource: 'r' }, z.number())
        if (!Result.isError(result)) throw new Error('expected an error')
        expect(httpStatusOf(result.error)).toBeUndefined()
    })
})
