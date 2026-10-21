import { Result } from 'better-result'
import {
    createObservationsClient,
    type DataEngineLike,
    type DataEngineValue,
} from './client'
import {
    EVENTS_MAX_PAGES,
    EVENTS_PAGE_SIZE,
    fetchDataElements,
    fetchEnrollment,
    fetchEvents,
    fetchStages,
} from './queries'

const eventsOf = (count: number, offset = 0) =>
    Array.from({ length: count }, (_, i) => ({
        event: `e${offset + i}`,
        programStage: 's1',
        status: 'COMPLETED',
        occurredAt: '2026-03-12T00:00:00.000',
        dataValues: [],
    }))

const engineReturning = (pages: DataEngineValue[]) => {
    const query = vi.fn<DataEngineLike['query']>()
    for (const page of pages) {
        query.mockResolvedValueOnce({ observationsResource: page })
    }
    return { engine: { query } satisfies DataEngineLike, query }
}

const requestOf = (
    query: ReturnType<typeof engineReturning>['query'],
    call: number
) => Object.values(query.mock.calls[call]?.[0] ?? {})[0]

describe('fetchEvents', () => {
    const subject = { trackedEntityId: 'te1', programId: 'p1' }

    it('requests pages until a short page', async () => {
        const { engine, query } = engineReturning([
            { events: eventsOf(200) },
            { events: eventsOf(200, 200) },
            { events: eventsOf(13, 400) },
        ])

        const result = await fetchEvents(
            createObservationsClient(engine),
            subject
        )

        expect(Result.isOk(result) && result.value).toHaveLength(413)
        expect(query).toHaveBeenCalledTimes(3)
        expect([0, 1, 2].map((i) => requestOf(query, i)?.params?.page)).toEqual(
            [1, 2, 3]
        )
        expect(requestOf(query, 0)).toMatchObject({
            resource: 'tracker/events',
            params: {
                trackedEntity: 'te1',
                program: 'p1',
                pageSize: EVENTS_PAGE_SIZE,
            },
        })
    })

    it('stops after one call when the first page is short', async () => {
        const { engine, query } = engineReturning([{ instances: eventsOf(3) }])

        const result = await fetchEvents(
            createObservationsClient(engine),
            subject
        )

        expect(Result.isOk(result) && result.value).toHaveLength(3)
        expect(query).toHaveBeenCalledTimes(1)
    })

    it('returns an error result on HTTP failure', async () => {
        const query = vi
            .fn<DataEngineLike['query']>()
            .mockRejectedValue(
                Object.assign(new Error('Server error'), { status: 500 })
            )

        const result = await fetchEvents(
            createObservationsClient({ query }),
            subject
        )

        expect(Result.isError(result) && result.error.message).toContain(
            'Server error'
        )
    })

    it('returns an error result when a later page fails', async () => {
        const query = vi
            .fn<DataEngineLike['query']>()
            .mockResolvedValueOnce({
                observationsResource: { events: eventsOf(200) },
            })
            .mockRejectedValueOnce(new Error('Gateway timeout'))

        const result = await fetchEvents(
            createObservationsClient({ query }),
            subject
        )

        expect(Result.isError(result)).toBe(true)
    })

    it('returns an error result for a malformed response', async () => {
        const { engine } = engineReturning([{ unexpected: true }])

        const result = await fetchEvents(
            createObservationsClient(engine),
            subject
        )

        expect(Result.isError(result)).toBe(true)
    })

    it('asks for the tracked entity and a stable order', async () => {
        const { engine, query } = engineReturning([{ events: [] }])

        await fetchEvents(createObservationsClient(engine), subject)

        expect(requestOf(query, 0)).toMatchObject({
            params: {
                fields: 'event,trackedEntity,programStage,status,occurredAt,createdAt,dataValues[dataElement,value]',
                order: 'occurredAt:asc,createdAt:asc',
            },
        })
    })

    it('drops events that belong to another tracked entity', async () => {
        const [own, other, unstated] = eventsOf(3)
        const { engine } = engineReturning([
            {
                events: [
                    { ...own, trackedEntity: 'te1' },
                    { ...other, trackedEntity: 'someoneElse' },
                    unstated,
                ],
            },
        ])

        const result = await fetchEvents(
            createObservationsClient(engine),
            subject
        )

        expect(
            Result.isOk(result) && result.value.map((event) => event.event)
        ).toEqual(['e0', 'e2'])
    })

    it('counts an event repeated across pages once', async () => {
        const firstPage = eventsOf(EVENTS_PAGE_SIZE)
        const { engine, query } = engineReturning([
            { events: firstPage },
            { events: [firstPage[EVENTS_PAGE_SIZE - 1], ...eventsOf(2, 500)] },
        ])

        const result = await fetchEvents(
            createObservationsClient(engine),
            subject
        )

        expect(query).toHaveBeenCalledTimes(2)
        const ids = Result.isOk(result) ? result.value.map((e) => e.event) : []
        expect(ids).toHaveLength(EVENTS_PAGE_SIZE + 2)
        expect(new Set(ids).size).toBe(ids.length)
    })

    it(`is an error, not a truncated list, past ${EVENTS_MAX_PAGES} full pages`, async () => {
        const query = vi
            .fn<DataEngineLike['query']>()
            .mockImplementation(async (request) => {
                const page = Number(
                    Object.values(request)[0]?.params?.page ?? 0
                )
                return {
                    observationsResource: {
                        events: eventsOf(
                            EVENTS_PAGE_SIZE,
                            page * EVENTS_PAGE_SIZE
                        ),
                    },
                }
            })

        const result = await fetchEvents(
            createObservationsClient({ query }),
            subject
        )

        expect(EVENTS_MAX_PAGES).toBe(50)
        expect(query).toHaveBeenCalledTimes(EVENTS_MAX_PAGES + 1)
        expect(Result.isError(result) && result.error.message).toContain(
            'Too many events'
        )
    })

    it(`loads exactly ${EVENTS_MAX_PAGES} full pages when the next one is empty`, async () => {
        const query = vi
            .fn<DataEngineLike['query']>()
            .mockImplementation(async (request) => {
                const page = Number(
                    Object.values(request)[0]?.params?.page ?? 0
                )
                return {
                    observationsResource: {
                        events:
                            page > EVENTS_MAX_PAGES
                                ? []
                                : eventsOf(
                                      EVENTS_PAGE_SIZE,
                                      page * EVENTS_PAGE_SIZE
                                  ),
                    },
                }
            })

        const result = await fetchEvents(
            createObservationsClient({ query }),
            subject
        )

        expect(query).toHaveBeenCalledTimes(EVENTS_MAX_PAGES + 1)
        expect(Result.isOk(result) && result.value).toHaveLength(
            EVENTS_MAX_PAGES * EVENTS_PAGE_SIZE
        )
    })
})

describe('fetchEnrollment', () => {
    const subject = { trackedEntityId: 'te1', programId: 'p1' }

    it('asks for one enrollment of the person in the program', async () => {
        const { engine, query } = engineReturning([
            { enrollments: [{ enrollment: 'en1' }] },
        ])

        const result = await fetchEnrollment(
            createObservationsClient(engine),
            subject
        )

        expect(requestOf(query, 0)).toEqual({
            resource: 'tracker/enrollments',
            params: {
                trackedEntity: 'te1',
                program: 'p1',
                fields: 'enrollment',
                pageSize: 1,
            },
        })
        expect(Result.isOk(result) && result.value).toBe('en1')
    })

    it('reads the legacy instances envelope', async () => {
        const { engine } = engineReturning([
            { instances: [{ enrollment: 'en1' }] },
        ])

        const result = await fetchEnrollment(
            createObservationsClient(engine),
            subject
        )

        expect(Result.isOk(result) && result.value).toBe('en1')
    })

    it('is an error when the person has no visible enrollment', async () => {
        const { engine } = engineReturning([{ enrollments: [] }])

        const result = await fetchEnrollment(
            createObservationsClient(engine),
            subject
        )

        expect(Result.isError(result) && result.error.message).toBe(
            'This person has no visible enrollment in this program'
        )
    })

    it('returns an error result on HTTP failure', async () => {
        const query = vi
            .fn<DataEngineLike['query']>()
            .mockRejectedValue(new Error('Forbidden'))

        const result = await fetchEnrollment(
            createObservationsClient({ query }),
            subject
        )

        expect(Result.isError(result) && result.error.message).toContain(
            'Forbidden'
        )
    })
})

describe('fetchDataElements', () => {
    it('sends one id:in filter', async () => {
        const { engine, query } = engineReturning([{ dataElements: [] }])

        await fetchDataElements(createObservationsClient(engine), [
            'a',
            'b',
            'c',
        ])

        expect(query).toHaveBeenCalledTimes(1)
        expect(requestOf(query, 0)).toMatchObject({
            resource: 'dataElements',
            params: { filter: 'id:in:[a,b,c]', paging: false },
        })
    })

    it('asks for translated option and legend names', async () => {
        const { engine, query } = engineReturning([{ dataElements: [] }])

        await fetchDataElements(createObservationsClient(engine), ['a'])

        const fields = String(requestOf(query, 0)?.params?.fields)
        expect(fields).toContain(
            'options[code,displayName~rename(name),style[color]]'
        )
        expect(fields).toContain(
            'legends[displayName~rename(name),color,startValue,endValue]'
        )
    })

    it('makes no request for an empty id list', async () => {
        const { engine, query } = engineReturning([])

        const result = await fetchDataElements(
            createObservationsClient(engine),
            []
        )

        expect(Result.isOk(result) && result.value).toEqual([])
        expect(query).not.toHaveBeenCalled()
    })
})

describe('fetchStages', () => {
    it('reads the program with stage access and data element ids', async () => {
        const { engine, query } = engineReturning([
            {
                programStages: [
                    {
                        id: 's1',
                        displayName: 'Visit',
                        access: { data: { read: true } },
                        programStageDataElements: [
                            { dataElement: { id: 'de1' } },
                        ],
                    },
                ],
            },
        ])

        const result = await fetchStages(createObservationsClient(engine), 'p1')

        expect(requestOf(query, 0)).toMatchObject({
            resource: 'programs',
            id: 'p1',
            params: {
                fields: 'programStages[id,displayName,access[data[read]],programStageDataElements[dataElement[id]]]',
            },
        })
        expect(Result.isOk(result) && result.value).toEqual([
            {
                id: 's1',
                displayName: 'Visit',
                canReadData: true,
                dataElementIds: ['de1'],
            },
        ])
    })
})
