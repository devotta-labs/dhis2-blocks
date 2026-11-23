import { z, ZodError } from 'zod'
import { openWorkingListServer } from '../test/workingListServer'
import {
    QueryEnvelopeSchema,
    shouldRetryWorkingListRequest,
    WorkingListBoundaryError,
} from './client'

const ResponseSchema = z
    .object({ id: z.string().min(1), required: z.number() })
    .passthrough()

describe('validated DataEngine-like client', () => {
    it('accepts unknown additional fields while validating known fields', async () => {
        const { client } = await openWorkingListServer(({ pathname }) => {
            if (pathname.endsWith('/anything')) {
                return Response.json({
                    id: 'Result00001',
                    required: 1,
                    futureField: 'kept',
                })
            }
        })

        await expect(
            client.query({ resource: 'anything' }, ResponseSchema)
        ).resolves.toEqual({
            id: 'Result00001',
            required: 1,
            futureField: 'kept',
        })
    })

    it('fails hard for malformed envelopes and resources', async () => {
        expect(() => QueryEnvelopeSchema.parse({ wrongKey: {} })).toThrow(
            ZodError
        )
        const { client } = await openWorkingListServer(({ pathname }) => {
            if (pathname.endsWith('/anything')) {
                return Response.json({ id: 'Result00001' })
            }
        })
        await expect(
            client.query({ resource: 'anything' }, ResponseSchema)
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
