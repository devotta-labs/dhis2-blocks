import { Result } from 'better-result'
import { z } from 'zod'
import {
    createObservationsClient,
    createObservationsResourceClient,
    type DataEngineLike,
    type ObservationsClient,
    resourceClientOf,
    shouldRetryObservationsRequest,
} from './client'

const failWith = async (cause: unknown) => {
    const query = vi.fn<DataEngineLike['query']>().mockRejectedValue(cause)
    const result = await createObservationsResourceClient({ query }).query(
        { resource: 'programs' },
        z.unknown()
    )
    if (Result.isOk(result)) {
        throw new Error('expected an error result')
    }
    return result.error
}

describe('shouldRetryObservationsRequest', () => {
    it('retries server and network failures twice', async () => {
        const serverError = await failWith(
            Object.assign(new Error('Bad gateway'), { httpStatusCode: 502 })
        )
        const networkError = await failWith(new Error('Failed to fetch'))

        expect(shouldRetryObservationsRequest(0, serverError)).toBe(true)
        expect(shouldRetryObservationsRequest(1, networkError)).toBe(true)
        expect(shouldRetryObservationsRequest(2, serverError)).toBe(false)
    })

    it('does not retry a client error', async () => {
        const forbidden = await failWith(
            Object.assign(new Error('Forbidden'), {
                details: { httpStatusCode: 403 },
            })
        )

        expect(shouldRetryObservationsRequest(0, forbidden)).toBe(false)
    })

    it('does not retry a malformed response or a missing enrollment', async () => {
        const query = vi
            .fn<DataEngineLike['query']>()
            .mockResolvedValue({ observationsResource: { unexpected: true } })
        const malformed = await createObservationsResourceClient({
            query,
        }).query(
            { resource: 'programs' },
            z.object({ programStages: z.array(z.unknown()) })
        )

        expect(Result.isError(malformed)).toBe(true)
        expect(
            Result.isError(malformed) &&
                shouldRetryObservationsRequest(0, malformed.error)
        ).toBe(false)
        expect(
            shouldRetryObservationsRequest(
                0,
                new Error(
                    'This person has no visible enrollment in this program'
                )
            )
        ).toBe(false)
    })
})

describe('resourceClientOf', () => {
    it('runs requests only for a client made by createObservationsClient', () => {
        const engine: DataEngineLike = { query: vi.fn() }

        expect(resourceClientOf(createObservationsClient(engine))).toBeDefined()
        expect(() =>
            // SAFETY: the test passes a foreign object to prove it is refused.
            resourceClientOf({} as ObservationsClient)
        ).toThrow('createObservationsClient')
    })
})
