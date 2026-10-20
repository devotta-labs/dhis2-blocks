import { CustomDataProvider } from '@dhis2/app-runtime'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { type ComponentProps, type ReactNode } from 'react'
import { renderHook } from 'vitest-browser-react'
import {
    useTrackedEntityObservations,
    type TrackedEntityObservations,
} from './use-tracked-entity-observations'

const WEIGHT = 'weightDE0001'
const TEMP = 'tempDE00001'

const stagesResponse = {
    programStages: [
        {
            id: 'stage1',
            displayName: 'Visit',
            access: { data: { read: true } },
            programStageDataElements: [
                { dataElement: { id: WEIGHT } },
                { dataElement: { id: TEMP } },
            ],
        },
    ],
}

const dataElementsResponse = {
    dataElements: [
        { id: WEIGHT, displayName: 'Weight', valueType: 'NUMBER' },
        { id: TEMP, displayName: 'Temperature', valueType: 'NUMBER' },
    ],
}

const eventsResponse = {
    events: [
        {
            event: 'ev1',
            programStage: 'stage1',
            status: 'COMPLETED',
            occurredAt: '2026-03-01T00:00:00.000',
            dataValues: [{ dataElement: WEIGHT, value: '70' }],
        },
        {
            event: 'ev2',
            programStage: 'stage1',
            status: 'COMPLETED',
            occurredAt: '2026-03-12T00:00:00.000',
            dataValues: [{ dataElement: WEIGHT, value: '71.4' }],
        },
    ],
}

type CustomData = ComponentProps<typeof CustomDataProvider>['data']
type JsonValue =
    | string
    | number
    | boolean
    | null
    | JsonValue[]
    | { [key: string]: JsonValue }
type Resolver = () => JsonValue
type Resolvers = Record<
    'programs' | 'dataElements' | 'tracker/events' | 'tracker/enrollments',
    Resolver
>

const enrollmentsResponse = { enrollments: [{ enrollment: 'enr1' }] }

const setup = (overrides: Partial<Resolvers> = {}) => {
    const calls: Array<{ resource: string; id?: string }> = []
    const resolvers = {
        programs: () => stagesResponse,
        dataElements: () => dataElementsResponse,
        'tracker/events': () => eventsResponse,
        'tracker/enrollments': () => enrollmentsResponse,
        ...overrides,
    } satisfies Resolvers
    const data: CustomData = {}
    for (const [resource, resolve] of Object.entries(resolvers)) {
        data[resource] = async (_type, query) => {
            calls.push({ resource: query.resource, id: query.id })
            return resolve()
        }
    }
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    const wrapper = ({ children }: { children: ReactNode }) => (
        <CustomDataProvider data={data}>
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </CustomDataProvider>
    )
    return { calls, queryClient, wrapper }
}

const render = (
    wrapper: ReturnType<typeof setup>['wrapper'],
    dataElementIds: string[] = [WEIGHT, TEMP],
    { trackedEntityId = 'te1', programId = 'prog1' } = {}
) =>
    renderHook(
        () =>
            useTrackedEntityObservations({
                trackedEntityId,
                programId,
                dataElementIds,
            }),
        { wrapper }
    )

const settled = (result: { current: TrackedEntityObservations }) =>
    expect.poll(() => result.current.status).not.toBe('pending')

describe('useTrackedEntityObservations', () => {
    it('is pending, then success with one series per requested element', async () => {
        const { wrapper } = setup()
        const { result } = await render(wrapper)

        expect(result.current.status).toBe('pending')
        expect(result.current.get(WEIGHT)).toEqual({ status: 'pending' })

        await settled(result)

        expect(result.current.status).toBe('success')
        const weight = result.current.get(WEIGHT)
        const temp = result.current.get(TEMP)
        if (weight.status !== 'success' || temp.status !== 'success') {
            throw new Error('expected both series to succeed')
        }
        expect(weight.series.dataElementId).toBe(WEIGHT)
        expect(weight.series.points.map((p) => p.value)).toEqual(['70', '71.4'])
        expect(weight.series.change).toBeCloseTo(1.4)
        expect(temp.series.dataElementId).toBe(TEMP)
        expect(temp.series.points).toEqual([])
    })

    it('a failed events request makes every get() an error', async () => {
        const { wrapper } = setup({
            'tracker/events': () => {
                throw new Error('boom')
            },
        })
        const { result } = await render(wrapper)

        await settled(result)

        expect(result.current.status).toBe('error')
        expect(result.current.error?.message).toContain('boom')
        for (const id of [WEIGHT, TEMP]) {
            expect(result.current.get(id).status).toBe('error')
        }
    })

    it('get() for an unrequested id is an error naming the id', async () => {
        const { wrapper } = setup()
        const { result } = await render(wrapper, [WEIGHT])

        await settled(result)

        const missing = result.current.get('notRequested')
        if (missing.status !== 'error') {
            throw new Error('expected an error result')
        }
        expect(missing.error.message).toContain('notRequested')
    })

    it('get() for an id the server did not return is an error naming the id', async () => {
        const { wrapper } = setup({
            dataElements: () => ({
                dataElements: [dataElementsResponse.dataElements[0]],
            }),
        })
        const { result } = await render(wrapper)

        await settled(result)

        expect(result.current.status).toBe('success')
        expect(result.current.get(WEIGHT).status).toBe('success')
        const missing = result.current.get(TEMP)
        if (missing.status !== 'error') {
            throw new Error('expected an error result')
        }
        expect(missing.error.message).toContain(TEMP)
    })

    it('a person with no visible enrollment makes every get() an error', async () => {
        const { wrapper } = setup({
            'tracker/enrollments': () => ({ enrollments: [] }),
        })
        const { result } = await render(wrapper)

        await settled(result)

        expect(result.current.status).toBe('error')
        expect(result.current.error?.message).toBe(
            'This person has no visible enrollment in this program'
        )
        for (const id of [WEIGHT, TEMP]) {
            expect(result.current.get(id).status).toBe('error')
        }
    })

    it.each([
        { trackedEntityId: '', programId: 'prog1' },
        { trackedEntityId: '   ', programId: 'prog1' },
        { trackedEntityId: 'te1', programId: '' },
    ])('makes no request and stays pending for %o', async (ids) => {
        const { calls, wrapper } = setup()
        const { result } = await render(wrapper, [WEIGHT], ids)

        // Long enough for an enabled query to have started.
        await new Promise((resolve) => setTimeout(resolve, 50))

        expect(calls).toEqual([])
        expect(result.current.status).toBe('pending')
        expect(result.current.get(WEIGHT)).toEqual({ status: 'pending' })
    })

    it('makes four requests in parallel per person, keyed by observation-cards', async () => {
        const { calls, queryClient, wrapper } = setup()
        const { result } = await render(wrapper, [TEMP, WEIGHT, TEMP])

        await settled(result)

        expect(calls.map((c) => c.resource).sort()).toEqual([
            'dataElements',
            'programs',
            'tracker/enrollments',
            'tracker/events',
        ])
        expect(calls.find((c) => c.resource === 'programs')?.id).toBe('prog1')
        const keys = queryClient
            .getQueryCache()
            .getAll()
            .map((q) => q.queryKey)
        expect(keys).toEqual(
            expect.arrayContaining([
                ['observation-cards', 'stages', 'prog1'],
                ['observation-cards', 'dataElements', [TEMP, WEIGHT].sort()],
                ['observation-cards', 'events', 'te1', 'prog1'],
                ['observation-cards', 'enrollments', 'te1', 'prog1'],
            ])
        )
        expect(keys).toHaveLength(4)
    })

    it('keeps get() stable while the data is unchanged', async () => {
        const { wrapper } = setup()
        const { result, rerender } = await render(wrapper)
        await settled(result)

        const before = result.current.get
        await rerender()

        expect(result.current.get).toBe(before)
    })
})
