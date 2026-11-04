import { Result } from 'better-result'
import { programMetadataResponse } from '../__tests__/fixtures'
import { buildSeries } from './buildSeries'
import {
    createObservationsResourceClient,
    type DataEngineLike,
    type DataEngineValue,
} from './client'
import {
    EVENTS_MAX_PAGES,
    EVENTS_PAGE_SIZE,
    fetchEnrollment,
    fetchEvents,
    fetchProgramMetadata,
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
            createObservationsResourceClient(engine),
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
            createObservationsResourceClient(engine),
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
            createObservationsResourceClient({ query }),
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
            createObservationsResourceClient({ query }),
            subject
        )

        expect(Result.isError(result)).toBe(true)
    })

    it('returns an error result for a malformed response', async () => {
        const { engine } = engineReturning([{ unexpected: true }])

        const result = await fetchEvents(
            createObservationsResourceClient(engine),
            subject
        )

        expect(Result.isError(result)).toBe(true)
    })

    it('asks for the tracked entity and a stable order', async () => {
        const { engine, query } = engineReturning([{ events: [] }])

        await fetchEvents(createObservationsResourceClient(engine), subject)

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
            createObservationsResourceClient(engine),
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
            createObservationsResourceClient(engine),
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
            createObservationsResourceClient({ query }),
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
            createObservationsResourceClient({ query }),
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
            createObservationsResourceClient(engine),
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
            createObservationsResourceClient(engine),
            subject
        )

        expect(Result.isOk(result) && result.value).toBe('en1')
    })

    it('is an error when the person has no visible enrollment', async () => {
        const { engine } = engineReturning([{ enrollments: [] }])

        const result = await fetchEnrollment(
            createObservationsResourceClient(engine),
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
            createObservationsResourceClient({ query }),
            subject
        )

        expect(Result.isError(result) && result.error.message).toContain(
            'Forbidden'
        )
    })
})

describe('fetchProgramMetadata', () => {
    const fetchFixture = async () => {
        const { engine, query } = engineReturning([programMetadataResponse()])
        const result = await fetchProgramMetadata(
            createObservationsResourceClient(engine),
            'p1'
        )
        if (Result.isError(result)) {
            throw result.error
        }
        return { metadata: result.value, query }
    }

    it("reads the program's stages and data elements in one request", async () => {
        const { metadata, query } = await fetchFixture()

        expect(query).toHaveBeenCalledTimes(1)
        expect(requestOf(query, 0)).toEqual({
            resource: 'programs',
            id: 'p1',
            params: {
                fields: 'programStages[id,displayName,access[data[read]],programStageDataElements[dataElement[id,displayName,displayFormName,valueType,legendSets[legends[displayName~rename(name),color,startValue,endValue]],optionSet[options[code,displayName~rename(name),style[color]]]]]]',
            },
        })
        expect(metadata.stages).toHaveLength(5)
        expect(metadata.dataElements.get('vANAXwtLwcT')?.displayName).toBe(
            'WHOMCH Hemoglobin value'
        )
    })

    it("keeps each stage's data-read access", async () => {
        const { engine } = engineReturning([
            {
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
                        programStageDataElements: [],
                    },
                ],
            },
        ])

        const result = await fetchProgramMetadata(
            createObservationsResourceClient(engine),
            'p1'
        )

        expect(
            Result.isOk(result) &&
                result.value.stages.map(({ id, canReadData }) => [
                    id,
                    canReadData,
                ])
        ).toEqual([
            ['hidden', false],
            ['open', true],
        ])
    })

    it('gives series legends sorted by startValue', async () => {
        const { metadata } = await fetchFixture()
        const dataElement = metadata.dataElements.get('qrur9Dvnyt5')
        if (!dataElement) {
            throw new Error('expected the legend-set fixture element')
        }

        const series = buildSeries({
            dataElement,
            stages: metadata.stages,
            events: [],
        })

        const starts = series.legends?.map((legend) => legend.startValue)
        expect(starts).toEqual([...(starts ?? [])].sort((a, b) => a - b))
        expect(starts?.length).toBeGreaterThan(1)
    })

    it("keeps an option's style colour", async () => {
        const { metadata } = await fetchFixture()

        expect(
            metadata.dataElements.get('CLC5VYdZBay')?.optionSet?.options[0]
        ).toEqual({
            code: 'ACT x6',
            name: 'ACT x6',
            style: { color: 'ffef78' },
        })
    })

    it('returns an error result on HTTP failure', async () => {
        const query = vi
            .fn<DataEngineLike['query']>()
            .mockRejectedValue(new Error('Forbidden'))

        const result = await fetchProgramMetadata(
            createObservationsResourceClient({ query }),
            'p1'
        )

        expect(Result.isError(result) && result.error.message).toContain(
            'Forbidden'
        )
    })
})
