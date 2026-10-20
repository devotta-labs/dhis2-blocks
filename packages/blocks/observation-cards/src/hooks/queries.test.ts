import { Result } from 'better-result'
import {
    createObservationsClient,
    type DataEngineLike,
    type DataEngineValue,
} from './client'
import {
    EVENTS_PAGE_SIZE,
    fetchDataElements,
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
