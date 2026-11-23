import { openDhis2TestServer } from '../../../test/dhis2-server.test-utils'
import { Result } from 'better-result'
import { z } from 'zod'
import {
    createOrgUnitResourceClient,
    shouldRetryOrgUnitRequest,
} from './client'

const failWith = async (httpStatusCode: number, message: string) => {
    const { engine } = await openDhis2TestServer((url) =>
        url.pathname === '/api/42/me'
            ? Response.json(
                  { httpStatusCode, message },
                  { status: httpStatusCode }
              )
            : undefined
    )
    const result = await createOrgUnitResourceClient(engine).query(
        { resource: 'me' },
        z.unknown()
    )
    if (Result.isOk(result)) {
        throw new Error('expected an error result')
    }
    return result.error
}

describe('shouldRetryOrgUnitRequest', () => {
    it('retries a server failure on the first failure', async () => {
        const unavailable = await failWith(503, 'Unavailable')

        expect(shouldRetryOrgUnitRequest(0, unavailable)).toBe(true)
    })

    it('does not retry a client error', async () => {
        const forbidden = await failWith(403, 'Forbidden')

        expect(shouldRetryOrgUnitRequest(0, forbidden)).toBe(false)
    })

    it('stops after the second failure', async () => {
        const unavailable = await failWith(503, 'Unavailable')

        expect(shouldRetryOrgUnitRequest(2, unavailable)).toBe(false)
    })
})
