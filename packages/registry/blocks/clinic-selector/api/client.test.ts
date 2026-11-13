import { Result } from 'better-result'
import { z } from 'zod'
import {
    createClinicResourceClient,
    type DataEngineLike,
    shouldRetryClinicRequest,
} from './client'

const failWith = async (cause: unknown) => {
    const query = vi.fn<DataEngineLike['query']>().mockRejectedValue(cause)
    const result = await createClinicResourceClient({ query }).query(
        { resource: 'me' },
        z.unknown()
    )
    if (Result.isOk(result)) {
        throw new Error('expected an error result')
    }
    return result.error
}

describe('shouldRetryClinicRequest', () => {
    it('retries a server failure on the first failure', async () => {
        const unavailable = await failWith(
            Object.assign(new Error('Unavailable'), { httpStatusCode: 503 })
        )

        expect(shouldRetryClinicRequest(0, unavailable)).toBe(true)
    })

    it('does not retry a client error', async () => {
        const forbidden = await failWith(
            Object.assign(new Error('Forbidden'), {
                details: { httpStatusCode: 403 },
            })
        )

        expect(shouldRetryClinicRequest(0, forbidden)).toBe(false)
    })

    it('stops after the second failure', async () => {
        const unavailable = await failWith(
            Object.assign(new Error('Unavailable'), { httpStatusCode: 503 })
        )

        expect(shouldRetryClinicRequest(2, unavailable)).toBe(false)
    })
})
