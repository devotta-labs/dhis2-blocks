import { z, ZodError } from 'zod'
import {
    createWorkingListClient,
    shouldRetryWorkingListRequest,
    type DataEngineLike,
    WorkingListBoundaryError,
} from './client'

const ResponseSchema = z
    .object({ id: z.string().min(1), required: z.number() })
    .passthrough()

describe('validated DataEngine-like client', () => {
    it('accepts unknown additional fields while validating known fields', async () => {
        const engine: DataEngineLike = {
            query: vi.fn().mockResolvedValue({
                workingListResource: {
                    id: 'Result00001',
                    required: 1,
                    futureField: 'kept',
                },
            }),
            mutate: vi.fn(),
        }

        await expect(
            createWorkingListClient(engine).query(
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
            mutate: vi.fn(),
        }

        const malformedResource: DataEngineLike = {
            query: vi.fn().mockResolvedValue({
                workingListResource: { id: 'Result00001' },
            }),
            mutate: vi.fn(),
        }

        await expect(
            createWorkingListClient(missingEnvelope).query(
                { resource: 'anything' },
                ResponseSchema
            )
        ).rejects.toBeInstanceOf(ZodError)
        await expect(
            createWorkingListClient(malformedResource).query(
                { resource: 'anything' },
                ResponseSchema
            )
        ).rejects.toBeInstanceOf(ZodError)
    })

    it('does not retry deterministic boundary or client failures', () => {
        expect(shouldRetryWorkingListRequest(0, new ZodError([]))).toBe(false)
        expect(shouldRetryWorkingListRequest(0, { status: 404 })).toBe(false)
        expect(
            shouldRetryWorkingListRequest(
                0,
                new WorkingListBoundaryError('malformed')
            )
        ).toBe(false)
        expect(shouldRetryWorkingListRequest(0, { status: 503 })).toBe(true)
        expect(shouldRetryWorkingListRequest(2, { status: 503 })).toBe(false)
    })
})
