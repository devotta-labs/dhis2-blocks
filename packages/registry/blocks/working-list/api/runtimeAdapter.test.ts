import { z, ZodError } from 'zod'
import { createRuntimeWorkingListClient } from './runtimeAdapter'
import type { DataEngineMutation } from './client'

const Response = z.object({ id: z.string() })
const engineFixture = () => ({
    query: vi.fn().mockResolvedValue({ workingListResource: { id: 'result' } }),
    mutate: vi.fn().mockResolvedValue({ id: 'result' }),
})

describe('native runtime adapter', () => {
    it('maps native query parameters and forwards the same AbortSignal', async () => {
        const engine = engineFixture()
        const client = createRuntimeWorkingListClient(engine)
        const signal = new AbortController().signal
        const request = {
            resource: 'programs',
            id: 'program',
            params: {
                fields: ['id', 'name'],
                page: 2,
                paging: true,
                unused: undefined,
            },
        }
        await expect(client.query(request, Response, signal)).resolves.toEqual({
            id: 'result',
        })
        expect(engine.query).toHaveBeenCalledWith(
            { workingListResource: request },
            { signal }
        )
        expect(engine.query.mock.calls[0][1].signal).toBe(signal)
    })

    it('rejects unsupported parameters before calling the engine', async () => {
        const engine = engineFixture()
        const client = createRuntimeWorkingListClient(engine)
        await expect(
            client.query(
                {
                    resource: 'programs',
                    params: {
                        // @ts-expect-error Deliberately malformed host input at the runtime boundary.
                        filter: { unsupported: true },
                    },
                },
                Response
            )
        ).rejects.toBeInstanceOf(ZodError)
        expect(engine.query).not.toHaveBeenCalled()
    })

    it.each([
        null,
        [],
        { wrongKey: {} },
        { workingListResource: new Date() },
        { workingListResource: { id: 42 } },
    ])('rejects malformed engine envelope %j', async (response) => {
        const engine = engineFixture()
        engine.query.mockResolvedValue(response)
        await expect(
            createRuntimeWorkingListClient(engine).query(
                { resource: 'programs' },
                Response
            )
        ).rejects.toBeInstanceOf(ZodError)
    })

    it.each(['create', 'update', 'replace', 'delete'] as const)(
        'maps %s bodies without mutation retries',
        async (type) => {
            const engine = engineFixture()
            const client = createRuntimeWorkingListClient(engine)
            const data = { name: 'View', filters: [{ value: 'active' }] }
            await client.mutate(
                { resource: 'filters', type, id: 'view', data },
                Response
            )
            let expected: DataEngineMutation = {
                resource: 'filters',
                type,
                data,
            }
            if (type === 'delete')
                expected = { resource: 'filters', type, id: 'view' }
            else if (type !== 'create') expected.id = 'view'
            expect(engine.mutate).toHaveBeenCalledExactlyOnceWith(expected)
            engine.mutate.mockRejectedValue(new Error('offline'))
            await expect(
                client.mutate(
                    { resource: 'filters', type, id: 'view', data },
                    Response
                )
            ).rejects.toThrow('offline')
            expect(engine.mutate).toHaveBeenCalledTimes(2)
        }
    )

    it.each(['update', 'replace', 'delete'] as const)(
        'rejects %s without an ID before calling native mutation',
        async (type) => {
            const engine = engineFixture()
            await expect(
                createRuntimeWorkingListClient(engine).mutate(
                    { resource: 'filters', type, data: {} },
                    Response
                )
            ).rejects.toThrow('requires an id')
            expect(engine.mutate).not.toHaveBeenCalled()
        }
    )

    it('validates mutation bodies and response schemas', async () => {
        const engine = engineFixture()
        const client = createRuntimeWorkingListClient(engine)
        await expect(
            client.mutate(
                { resource: 'filters', type: 'create', data: new Date() },
                Response
            )
        ).rejects.toBeInstanceOf(ZodError)
        expect(engine.mutate).not.toHaveBeenCalled()
        engine.mutate.mockResolvedValue(undefined)
        await expect(
            client.mutate(
                { resource: 'filters', type: 'delete', id: 'view' },
                z.undefined()
            )
        ).resolves.toBeUndefined()
    })
})
