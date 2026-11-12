import { CustomDataProvider, FetchError } from '@dhis2/app-runtime'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { type ComponentProps, type ReactNode } from 'react'
import { renderHook } from 'vitest-browser-react'
import { z } from 'zod'
import {
    EVENTS_MAX_PAGES,
    EVENTS_PAGE_SIZE,
    shouldRetryRequest,
    usePersonEvents,
    useProgramMetadata,
} from './queries'

type CustomData = ComponentProps<typeof CustomDataProvider>['data']

/** A request as the data engine hands it to the server. */
const RequestSchema = z.object({
    resource: z.string(),
    id: z.string().optional(),
    params: z.record(z.string(), z.json()).optional(),
})
type Request = z.infer<typeof RequestSchema>

const BodySchema = z.json()
type Respond = (request: Request) => Promise<z.infer<typeof BodySchema>>

interface Server {
    programs?: Respond
    enrollments?: Respond
    events?: Respond
}

const SUBJECT = { trackedEntity: 'te1', program: 'p1' }

const eventsOf = (count: number, offset = 0) =>
    Array.from({ length: count }, (_, i) => ({
        event: `e${offset + i}`,
        programStage: 's1',
        status: 'COMPLETED',
        occurredAt: '2026-03-12T00:00:00.000',
        dataValues: [],
    }))

const failure = (httpStatusCode: number) =>
    new FetchError({
        type: 'unknown',
        message: `HTTP ${httpStatusCode}`,
        details: { httpStatusCode },
    })

/** The person is enrolled and has no events, unless a test says otherwise. */
const setup = ({
    programs = async () => ({ programStages: [] }),
    enrollments = async () => ({ enrollments: [{ enrollment: 'en1' }] }),
    events = async () => ({ events: [] }),
}: Server = {}) => {
    const requests: Request[] = []
    const answer = (request: Request, respond: Respond) => {
        requests.push(request)
        return respond(request)
    }
    const data: CustomData = {
        programs: async (_type, query) =>
            answer(RequestSchema.parse(query), programs),
        'tracker/enrollments': async (_type, query) =>
            answer(RequestSchema.parse(query), enrollments),
        'tracker/events': async (_type, query) =>
            answer(RequestSchema.parse(query), events),
    }
    // Failures retry as in a host, without the wait between tries.
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retryDelay: 0 } },
    })
    const wrapper = ({ children }: { children: ReactNode }) => (
        <CustomDataProvider data={data}>
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </CustomDataProvider>
    )
    const requestsFor = (resource: string) =>
        requests.filter((request) => request.resource === resource)
    return { wrapper, requestsFor }
}

/** Serves the given pages of events in order, then empty pages. */
const pagesOf =
    (pages: Array<ReturnType<typeof eventsOf>>): Respond =>
    async ({ params }) => ({ events: pages[Number(params?.page) - 1] ?? [] })

describe('shouldRetryRequest', () => {
    it.each([
        { name: 'a server error', error: failure(500), retried: true },
        { name: 'a client error', error: failure(400), retried: false },
        {
            name: 'a network failure',
            error: new FetchError({
                type: 'network',
                message: 'offline',
                details: {},
            }),
            retried: true,
        },
        {
            name: 'no access',
            error: new FetchError({
                type: 'access',
                message: 'forbidden',
                details: { httpStatusCode: 403 },
            }),
            retried: false,
        },
        {
            name: "the data rules' own error",
            error: new Error('Too many events'),
            retried: false,
        },
    ])('$name: retried is $retried', ({ error, retried }) => {
        expect(shouldRetryRequest(0, error)).toBe(retried)
        expect(shouldRetryRequest(1, error)).toBe(retried)
        expect(shouldRetryRequest(2, error)).toBe(false)
    })
})

describe('usePersonEvents', () => {
    it('requests pages, in a stable order, until a short page', async () => {
        const { wrapper, requestsFor } = setup({
            events: pagesOf([
                eventsOf(200),
                eventsOf(200, 200),
                eventsOf(13, 400),
            ]),
        })

        const { result } = await renderHook(() => usePersonEvents(SUBJECT), {
            wrapper,
        })

        await expect.poll(() => result.current.data).toHaveLength(413)
        const requests = requestsFor('tracker/events')
        expect(requests.map((request) => request.params?.page)).toEqual([
            1, 2, 3,
        ])
        expect(requests[0]?.params).toEqual({
            trackedEntity: 'te1',
            program: 'p1',
            fields: 'event,trackedEntity,programStage,status,occurredAt,createdAt,dataValues[dataElement,value]',
            order: 'occurredAt:asc,createdAt:asc',
            pageSize: EVENTS_PAGE_SIZE,
            page: 1,
        })
    })

    it('stops after one request when the first page is short, in the legacy envelope too', async () => {
        const { wrapper, requestsFor } = setup({
            events: async () => ({ instances: eventsOf(3) }),
            enrollments: async () => ({
                instances: [{ enrollment: 'en1' }],
            }),
        })

        const { result } = await renderHook(() => usePersonEvents(SUBJECT), {
            wrapper,
        })

        await expect.poll(() => result.current.data).toHaveLength(3)
        expect(requestsFor('tracker/events')).toHaveLength(1)
    })

    it('asks for one enrollment of the person in the program', async () => {
        const { wrapper, requestsFor } = setup()

        const { result } = await renderHook(() => usePersonEvents(SUBJECT), {
            wrapper,
        })

        await expect.poll(() => result.current.data).toEqual([])
        expect(
            requestsFor('tracker/enrollments').map(({ params }) => params)
        ).toEqual([
            {
                trackedEntity: 'te1',
                program: 'p1',
                fields: 'enrollment',
                pageSize: 1,
            },
        ])
    })

    it('is an error when the person has no visible enrollment', async () => {
        const { wrapper } = setup({
            events: pagesOf([eventsOf(3)]),
            enrollments: async () => ({ enrollments: [] }),
        })

        const { result } = await renderHook(() => usePersonEvents(SUBJECT), {
            wrapper,
        })

        await expect
            .poll(() => result.current.error?.message)
            .toBe('This person has no visible enrollment in this program')
    })

    it('drops events that belong to another tracked entity', async () => {
        const [own, other, unstated] = eventsOf(3)
        const { wrapper } = setup({
            events: async () => ({
                events: [
                    { ...own, trackedEntity: 'te1' },
                    { ...other, trackedEntity: 'someoneElse' },
                    { ...unstated },
                ],
            }),
        })

        const { result } = await renderHook(() => usePersonEvents(SUBJECT), {
            wrapper,
        })

        await expect
            .poll(() => result.current.data?.map((event) => event.event))
            .toEqual(['e0', 'e2'])
    })

    it('counts an event repeated across pages once', async () => {
        const firstPage = eventsOf(EVENTS_PAGE_SIZE)
        const { wrapper, requestsFor } = setup({
            events: pagesOf([
                firstPage,
                [...firstPage.slice(-1), ...eventsOf(2, 500)],
            ]),
        })

        const { result } = await renderHook(() => usePersonEvents(SUBJECT), {
            wrapper,
        })

        await expect
            .poll(() => result.current.data)
            .toHaveLength(EVENTS_PAGE_SIZE + 2)
        const ids = result.current.data?.map((event) => event.event) ?? []
        expect(new Set(ids).size).toBe(ids.length)
        expect(requestsFor('tracker/events')).toHaveLength(2)
    })

    it(`is an error, not a truncated list, past ${EVENTS_MAX_PAGES} full pages`, async () => {
        const { wrapper, requestsFor } = setup({
            events: async ({ params }) => ({
                events: eventsOf(
                    EVENTS_PAGE_SIZE,
                    Number(params?.page) * EVENTS_PAGE_SIZE
                ),
            }),
        })

        const { result } = await renderHook(() => usePersonEvents(SUBJECT), {
            wrapper,
        })

        await expect
            .poll(() => result.current.error?.message)
            .toContain('Too many events')
        expect(EVENTS_MAX_PAGES).toBe(50)
        expect(requestsFor('tracker/events')).toHaveLength(EVENTS_MAX_PAGES + 1)
    })

    it(`loads exactly ${EVENTS_MAX_PAGES} full pages when the next one is empty`, async () => {
        const { wrapper, requestsFor } = setup({
            events: async ({ params }) => {
                const page = Number(params?.page)
                return {
                    events:
                        page > EVENTS_MAX_PAGES
                            ? []
                            : eventsOf(
                                  EVENTS_PAGE_SIZE,
                                  page * EVENTS_PAGE_SIZE
                              ),
                }
            },
        })

        const { result } = await renderHook(() => usePersonEvents(SUBJECT), {
            wrapper,
        })

        await expect
            .poll(() => result.current.data)
            .toHaveLength(EVENTS_MAX_PAGES * EVENTS_PAGE_SIZE)
        expect(requestsFor('tracker/events')).toHaveLength(EVENTS_MAX_PAGES + 1)
    })

    it('is an error for a malformed response, without a retry', async () => {
        const { wrapper, requestsFor } = setup({
            events: async () => ({ unexpected: true }),
        })

        const { result } = await renderHook(() => usePersonEvents(SUBJECT), {
            wrapper,
        })

        await expect.poll(() => result.current.isError).toBe(true)
        expect(requestsFor('tracker/events')).toHaveLength(1)
    })

    it.each([
        { status: 500, attempts: 3 },
        { status: 400, attempts: 1 },
    ])(
        'a later page failing with $status is an error after $attempts attempts',
        async ({ status, attempts }) => {
            const { wrapper, requestsFor } = setup({
                events: async ({ params }) => {
                    if (Number(params?.page) === 2) {
                        throw failure(status)
                    }
                    return { events: eventsOf(EVENTS_PAGE_SIZE) }
                },
            })

            const { result } = await renderHook(
                () => usePersonEvents(SUBJECT),
                { wrapper }
            )

            await expect.poll(() => result.current.isError).toBe(true)
            expect(
                requestsFor('tracker/events').filter(
                    (request) => request.params?.page === 2
                )
            ).toHaveLength(attempts)
        }
    )

    it.each([
        { trackedEntity: '', program: 'p1' },
        { trackedEntity: 'te1', program: '' },
    ])('makes no request for %o', async (subject) => {
        const { wrapper, requestsFor } = setup()

        const { result } = await renderHook(() => usePersonEvents(subject), {
            wrapper,
        })

        expect(result.current.fetchStatus).toBe('idle')
        expect(requestsFor('tracker/events')).toEqual([])
        expect(requestsFor('tracker/enrollments')).toEqual([])
    })
})

describe('useProgramMetadata', () => {
    it("reads the program's stages and data elements in one request", async () => {
        const { wrapper, requestsFor } = setup({
            programs: async () => ({
                programStages: [
                    {
                        id: 'hidden',
                        displayName: 'Hidden visit',
                        access: { data: { read: false } },
                        programStageDataElements: [],
                    },
                    {
                        id: 'open',
                        displayName: 'Open visit',
                        access: { data: { read: true } },
                        programStageDataElements: [
                            {
                                dataElement: {
                                    id: 'de1',
                                    displayName: 'Weight',
                                    valueType: 'NUMBER',
                                },
                            },
                        ],
                    },
                ],
            }),
        })

        const { result } = await renderHook(() => useProgramMetadata('p1'), {
            wrapper,
        })

        await expect
            .poll(() =>
                result.current.data?.stages.map(({ id, canReadData }) => [
                    id,
                    canReadData,
                ])
            )
            .toEqual([
                ['hidden', false],
                ['open', true],
            ])
        expect(result.current.data?.dataElements.get('de1')?.displayName).toBe(
            'Weight'
        )
        expect(requestsFor('programs')).toEqual([
            {
                resource: 'programs',
                id: 'p1',
                params: {
                    fields: 'programStages[id,displayName,access[data[read]],programStageDataElements[dataElement[id,displayName,displayFormName,valueType,legendSets[legends[displayName~rename(name),color,startValue,endValue]],optionSet[options[code,displayName~rename(name),style[color]]]]]]',
                },
            },
        ])
    })

    it('is an error when the request is refused, without a retry', async () => {
        const { wrapper, requestsFor } = setup({
            programs: async () => {
                throw failure(403)
            },
        })

        const { result } = await renderHook(() => useProgramMetadata('p1'), {
            wrapper,
        })

        await expect.poll(() => result.current.isError).toBe(true)
        expect(requestsFor('programs')).toHaveLength(1)
    })

    it('makes no request without a program', async () => {
        const { wrapper, requestsFor } = setup({ programs: async () => ({}) })

        const { result } = await renderHook(() => useProgramMetadata(''), {
            wrapper,
        })

        expect(result.current.fetchStatus).toBe('idle')
        expect(requestsFor('programs')).toEqual([])
    })
})
