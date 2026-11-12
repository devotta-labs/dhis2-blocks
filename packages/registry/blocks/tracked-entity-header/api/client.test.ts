import { Result } from 'better-result'
import { z } from 'zod'
import {
    createTrackedEntityHeaderClient,
    createTrackedEntityHeaderResourceClient,
    type DataEngineLike,
    isForbidden,
    resourceClientOf,
    shouldRetryTrackedEntityHeaderRequest,
    type TrackedEntityHeaderClient,
} from './client'

const failWith = async (cause: unknown) => {
    const query = vi.fn<DataEngineLike['query']>().mockRejectedValue(cause)
    const result = await createTrackedEntityHeaderResourceClient({
        query,
    }).query({ resource: 'programs' }, z.unknown())
    if (Result.isOk(result)) {
        throw new Error('expected an error result')
    }
    return result.error
}

const httpError = (httpStatusCode: number) =>
    failWith(Object.assign(new Error('Failed'), { httpStatusCode }))

describe('shouldRetryTrackedEntityHeaderRequest', () => {
    it('retries server and network failures twice', async () => {
        const serverError = await httpError(500)
        const networkError = await failWith(new Error('Failed to fetch'))

        expect(shouldRetryTrackedEntityHeaderRequest(0, serverError)).toBe(true)
        expect(shouldRetryTrackedEntityHeaderRequest(1, networkError)).toBe(
            true
        )
        expect(shouldRetryTrackedEntityHeaderRequest(2, serverError)).toBe(
            false
        )
    })

    it('never retries a 400 or a 403', async () => {
        expect(
            shouldRetryTrackedEntityHeaderRequest(0, await httpError(400))
        ).toBe(false)
        expect(
            shouldRetryTrackedEntityHeaderRequest(0, await httpError(403))
        ).toBe(false)
    })

    it('does not retry a response that fails the schema', async () => {
        const query = vi
            .fn<DataEngineLike['query']>()
            .mockResolvedValue({ trackedEntityHeaderResource: { odd: true } })

        const result = await createTrackedEntityHeaderResourceClient({
            query,
        }).query({ resource: 'programs' }, z.object({ id: z.string() }))

        expect(Result.isError(result)).toBe(true)
        expect(
            Result.isError(result) &&
                shouldRetryTrackedEntityHeaderRequest(0, result.error)
        ).toBe(false)
    })
})

describe('isForbidden', () => {
    it('is true for a thrown 403, however the engine nests the status', async () => {
        expect(isForbidden(await httpError(403))).toBe(true)
        expect(
            isForbidden(
                await failWith({
                    message: 'Forbidden',
                    details: { httpStatusCode: 403 },
                })
            )
        ).toBe(true)
    })

    it('is false for other failures, and never reads the message', async () => {
        expect(isForbidden(await httpError(500))).toBe(false)
        expect(isForbidden(await failWith(new Error('403 Forbidden')))).toBe(
            false
        )
        expect(isForbidden(new Error('403'))).toBe(false)
    })
})

describe('resourceClientOf', () => {
    it('runs requests only for a client made by createTrackedEntityHeaderClient', () => {
        const engine: DataEngineLike = { query: vi.fn() }

        expect(
            resourceClientOf(createTrackedEntityHeaderClient(engine))
        ).toBeDefined()
        expect(() =>
            // SAFETY: the test passes a foreign object to prove it is refused.
            resourceClientOf({} as TrackedEntityHeaderClient)
        ).toThrow('createTrackedEntityHeaderClient')
    })
})
