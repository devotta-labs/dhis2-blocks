import { z, ZodError } from 'zod'
import {
    createRelationshipViewerClient,
    RelationshipViewerBoundaryError,
    shouldRetryRelationshipRequest,
    type DataEngineLike,
} from './client'

const ResponseSchema = z
    .object({ id: z.string().min(1), required: z.number() })
    .passthrough()

describe('validated DataEngine-like client', () => {
    it('accepts unknown additional fields while validating known fields', async () => {
        const engine: DataEngineLike = {
            query: vi.fn().mockResolvedValue({
                relationshipViewerResource: {
                    id: 'Result00001',
                    required: 1,
                    futureField: 'kept',
                },
            }),
        }

        await expect(
            createRelationshipViewerClient(engine).query(
                { resource: 'anything' },
                ResponseSchema
            )
        ).resolves.toEqual({
            id: 'Result00001',
            required: 1,
            futureField: 'kept',
        })
    })

    it('fails hard for malformed envelopes and resources', async () => {
        const missingEnvelope: DataEngineLike = {
            query: vi.fn().mockResolvedValue({ wrongKey: {} }),
        }
        const malformedResource: DataEngineLike = {
            query: vi.fn().mockResolvedValue({
                relationshipViewerResource: { id: 'Result00001' },
            }),
        }

        await expect(
            createRelationshipViewerClient(missingEnvelope).query(
                { resource: 'anything' },
                ResponseSchema
            )
        ).rejects.toBeInstanceOf(ZodError)
        await expect(
            createRelationshipViewerClient(malformedResource).query(
                { resource: 'anything' },
                ResponseSchema
            )
        ).rejects.toBeInstanceOf(ZodError)
    })

    it('sends named resources in one engine query and passes the signal', async () => {
        const query = vi.fn().mockResolvedValue({ a: { n: 1 }, b: { n: 2 } })
        const signal = new AbortController().signal

        await expect(
            createRelationshipViewerClient({ query }).queryAll(
                { a: { resource: 'one' }, b: { resource: 'two', id: 'x' } },
                z.object({ a: z.object({ n: z.number() }), b: z.any() }),
                signal
            )
        ).resolves.toEqual({ a: { n: 1 }, b: { n: 2 } })
        expect(query).toHaveBeenCalledTimes(1)
        expect(query).toHaveBeenCalledWith(
            { a: { resource: 'one' }, b: { resource: 'two', id: 'x' } },
            { signal }
        )
    })

    it('does not retry client errors', () => {
        expect(shouldRetryRelationshipRequest(0, new ZodError([]))).toBe(false)
        expect(shouldRetryRelationshipRequest(0, { status: 404 })).toBe(false)
        expect(
            shouldRetryRelationshipRequest(
                0,
                new RelationshipViewerBoundaryError('malformed')
            )
        ).toBe(false)
        expect(shouldRetryRelationshipRequest(0, { status: 503 })).toBe(true)
        expect(shouldRetryRelationshipRequest(2, { status: 503 })).toBe(false)
    })

    it('reads the status of app-runtime FetchError shapes', () => {
        const fetchError = (
            type: string,
            message: string,
            details: Record<string, number> = {}
        ) => ({ type, message, details })

        expect(
            shouldRetryRelationshipRequest(
                0,
                fetchError('access', 'Conflict', { httpStatusCode: 409 })
            )
        ).toBe(false)
        expect(
            shouldRetryRelationshipRequest(
                0,
                fetchError('unknown', 'Not Found', { httpStatusCode: 404 })
            )
        ).toBe(false)
        expect(
            shouldRetryRelationshipRequest(
                0,
                fetchError(
                    'unknown',
                    'An unknown error occurred - Not Found (404)'
                )
            )
        ).toBe(false)
        expect(
            shouldRetryRelationshipRequest(
                0,
                fetchError(
                    'unknown',
                    'An unknown error occurred - Service Unavailable (503)'
                )
            )
        ).toBe(true)
        expect(
            shouldRetryRelationshipRequest(
                0,
                fetchError('network', 'Failed to fetch')
            )
        ).toBe(true)
    })
})
