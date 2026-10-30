import { z, ZodError } from 'zod'
import {
    createFinderResourceClient,
    createTrackedEntityFinderClient,
    FinderRequestError,
    resourceClientOf,
    shouldRetryFinderRequest,
} from './client'

const capture = async (error: Error) => {
    const client = createFinderResourceClient({
        query: () => Promise.reject(error),
    })
    try {
        await client.query({ resource: 'x' }, z.unknown())
    } catch (caught) {
        return caught
    }
    throw new Error('expected rejection')
}

describe('finder client', () => {
    it('maps a 409 under error.details to status 409', async () => {
        const caught = await capture(
            Object.assign(new Error('x'), {
                details: { httpStatusCode: 409, message: 'maxteicountreached' },
            })
        )
        expect(caught).toBeInstanceOf(FinderRequestError)
        expect(caught).toMatchObject({ status: 409 })
    })

    it('keeps the server message', async () => {
        const caught = await capture(
            Object.assign(new Error('x'), {
                details: { httpStatusCode: 409, message: 'maxteicountreached' },
            })
        )
        expect(caught).toMatchObject({ serverMessage: 'maxteicountreached' })
    })

    it('reads the status from the other shapes', async () => {
        const top = await capture(
            Object.assign(new Error('x'), { httpStatusCode: 404 })
        )
        const plain = await capture(
            Object.assign(new Error('x'), { status: 403 })
        )
        const response = await capture(
            Object.assign(new Error('x'), { response: { status: 502 } })
        )
        expect([top, plain, response]).toMatchObject([
            { status: 404 },
            { status: 403 },
            { status: 502 },
        ])
    })

    it('does not retry a 409 or a zod error, retries a 500 twice', async () => {
        const conflict = await capture(
            Object.assign(new Error('x'), { httpStatusCode: 409 })
        )
        const server = await capture(
            Object.assign(new Error('x'), { httpStatusCode: 500 })
        )
        const zodError = new ZodError([])
        expect(shouldRetryFinderRequest(0, conflict)).toBe(false)
        expect(shouldRetryFinderRequest(0, zodError)).toBe(false)
        expect(shouldRetryFinderRequest(0, server)).toBe(true)
        expect(shouldRetryFinderRequest(1, server)).toBe(true)
        expect(shouldRetryFinderRequest(2, server)).toBe(false)
    })

    it('rejects a client it did not create', () => {
        expect(() =>
            // SAFETY: the test passes a foreign object to prove it is refused.
            resourceClientOf(
                {} as ReturnType<typeof createTrackedEntityFinderClient>
            )
        ).toThrow(/createTrackedEntityFinderClient/)
    })

    it('hands out an opaque frozen client', () => {
        const client = createTrackedEntityFinderClient({
            query: async () => ({}),
        })
        expect(Object.isFrozen(client)).toBe(true)
        expect(Object.keys(client)).toEqual([])
        expect(resourceClientOf(client)).toBeDefined()
    })
})
