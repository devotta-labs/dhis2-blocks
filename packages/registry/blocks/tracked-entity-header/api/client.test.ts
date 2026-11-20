import { openDhis2TestServer } from '../../../test/dhis2-server.test-utils'
import { Result } from 'better-result'
import { z } from 'zod'
import {
    createTrackedEntityHeaderClient,
    createTrackedEntityHeaderResourceClient,
    isForbidden,
    resourceClientOf,
    shouldRetryTrackedEntityHeaderRequest,
    toRequestError,
    type TrackedEntityHeaderClient,
} from './client'

const servePrograms = (response: Response) =>
    openDhis2TestServer((url) =>
        url.pathname === '/api/42/programs' ? response : undefined
    )

const failWith = async (response: Response) => {
    const { engine } = await servePrograms(response)
    const result = await createTrackedEntityHeaderResourceClient(engine).query(
        { resource: 'programs' },
        z.unknown()
    )
    if (Result.isOk(result)) {
        throw new Error('expected an error result')
    }
    return result.error
}

const httpError = (httpStatusCode: number) =>
    failWith(Response.json({ httpStatusCode }, { status: httpStatusCode }))

describe('shouldRetryTrackedEntityHeaderRequest', () => {
    it('retries server and network failures twice', async () => {
        const serverError = await httpError(500)
        const networkError = await failWith(Response.error())

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
        const { engine } = await servePrograms(Response.json({ odd: true }))
        const result = await createTrackedEntityHeaderResourceClient(
            engine
        ).query({ resource: 'programs' }, z.object({ id: z.string() }))

        expect(Result.isError(result)).toBe(true)
        expect(
            Result.isError(result) &&
                shouldRetryTrackedEntityHeaderRequest(0, result.error)
        ).toBe(false)
    })
})

describe('isForbidden', () => {
    it('recognises a 403 from app-runtime and from either host error shape', async () => {
        expect(isForbidden(await httpError(403))).toBe(true)
        const direct = Object.assign(new Error('Forbidden'), {
            httpStatusCode: 403,
        })
        const nested = {
            message: 'Forbidden',
            details: { httpStatusCode: 403 },
        }
        expect(isForbidden(toRequestError(direct, 'programs'))).toBe(true)
        expect(isForbidden(toRequestError(nested, 'programs'))).toBe(true)
    })

    it('is false for other failures, and never reads the message', async () => {
        expect(isForbidden(await httpError(500))).toBe(false)
        expect(
            isForbidden(toRequestError(new Error('403 Forbidden'), 'programs'))
        ).toBe(false)
        expect(isForbidden(new Error('403'))).toBe(false)
    })
})

describe('resourceClientOf', () => {
    it('runs requests only for a client made by createTrackedEntityHeaderClient', async () => {
        const { engine } = await openDhis2TestServer(() => undefined)

        expect(
            resourceClientOf(createTrackedEntityHeaderClient(engine))
        ).toBeDefined()
        expect(() =>
            // SAFETY: the test passes a foreign object to prove it is refused.
            resourceClientOf({} as TrackedEntityHeaderClient)
        ).toThrow('createTrackedEntityHeaderClient')
    })
})
