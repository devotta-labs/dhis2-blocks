import { hashKey, QueryClient } from '@tanstack/react-query'
import stageFixture from './__fixtures__/rmnch-stage.json'
import eventFixture from './__fixtures__/event.json'
import {
    createEventFormClient,
    EventFormApiError,
    shouldRetryEventFormRequest,
    type DataEngineLike,
    type DataEngineValue,
} from './client'
import {
    eventFormKeys,
    fetchStageMetadata,
    fetchSystemCalendar,
    fetchTrackerEvent,
    STAGE_METADATA_FIELDS,
    stageMetadataQueryOptions,
    systemCalendarQueryOptions,
    trackerEventQueryOptions,
} from './queries'

const engineReturning = (response: DataEngineValue) => {
    const calls: Parameters<DataEngineLike['query']>[] = []
    const engine: DataEngineLike = {
        query: async (query, options) => {
            calls.push([query, options])
            return Object.fromEntries(
                Object.keys(query).map((key) => [key, response])
            )
        },
        mutate: async () => ({}),
    }
    return { engine, calls }
}

describe('eventFormKeys', () => {
    it('queries use stable keys', () => {
        expect(eventFormKeys.stage('WSGAb5XwJ3Y', 'WZbXY0S00lP')).toEqual(
            eventFormKeys.stage('WSGAb5XwJ3Y', 'WZbXY0S00lP')
        )
        expect(eventFormKeys.event('Evahwp3zrQ4')).toEqual(
            eventFormKeys.event('Evahwp3zrQ4')
        )
        expect(eventFormKeys.systemInfo()).toEqual(eventFormKeys.systemInfo())
        expect(eventFormKeys.stage('a', 'b')).not.toEqual(
            eventFormKeys.stage('a', 'c')
        )
        expect(eventFormKeys.event('a')).not.toEqual(eventFormKeys.event('b'))
        expect(eventFormKeys.stage('a', 'b')[0]).toBe('event-form')
    })

    it('hash to the same React Query key for the same arguments', () => {
        const { engine } = engineReturning(undefined)
        const eventClient = createEventFormClient(engine)
        const first = stageMetadataQueryOptions(eventClient, 'prog', 'stage')
        const second = stageMetadataQueryOptions(eventClient, 'prog', 'stage')
        expect(hashKey(first.queryKey)).toBe(hashKey(second.queryKey))
    })
})

describe('fetchers', () => {
    it('requests the stage metadata fields and narrows to the stage', async () => {
        const { engine, calls } = engineReturning(stageFixture)
        const result = await fetchStageMetadata(
            createEventFormClient(engine),
            'WSGAb5XwJ3Y',
            'WZbXY0S00lP'
        )

        expect(calls[0]?.[0]).toEqual({
            eventFormResource: {
                resource: 'programs',
                id: 'WSGAb5XwJ3Y',
                params: { fields: STAGE_METADATA_FIELDS },
            },
        })
        expect(result.unwrap().dataElements.size).toBe(49)
    })

    it('returns a not-found error for a stage the program lacks', async () => {
        const { engine } = engineReturning(stageFixture)
        const result = await fetchStageMetadata(
            createEventFormClient(engine),
            'WSGAb5XwJ3Y',
            'unknownStg1'
        )
        expect(result.isErr()).toBe(true)
        expect(result.isErr() && result.error.kind).toBe('not-found')
    })

    it('requests the tracker event with the form fields', async () => {
        const { engine, calls } = engineReturning(eventFixture)
        const result = await fetchTrackerEvent(
            createEventFormClient(engine),
            'Evahwp3zrQ4'
        )
        expect(calls[0]?.[0]).toEqual({
            eventFormResource: {
                resource: 'tracker/events',
                id: 'Evahwp3zrQ4',
                params: {
                    fields: 'event,program,programStage,enrollment,orgUnit,status,occurredAt,scheduledAt,geometry,dataValues[dataElement,value],notes',
                },
            },
        })
        expect(result.unwrap().event).toBe('Evahwp3zrQ4')
    })

    it('requests the system calendar', async () => {
        const { engine, calls } = engineReturning({
            calendar: 'iso8601',
            dateFormat: 'yyyy-mm-dd',
        })
        const result = await fetchSystemCalendar(createEventFormClient(engine))
        expect(calls[0]?.[0]).toEqual({
            eventFormResource: {
                resource: 'system/info',
                params: { fields: 'calendar,dateFormat' },
            },
        })
        expect(result.unwrap()).toEqual({
            calendar: 'iso8601',
            dateFormat: 'YYYY-MM-DD',
        })
    })

    it('returns invalid-response for a malformed event', async () => {
        const { engine } = engineReturning({ event: 'x' })
        const result = await fetchTrackerEvent(
            createEventFormClient(engine),
            'x'
        )
        expect(result.isErr() && result.error.kind).toBe('invalid-response')
    })

    it('returns a request error, with its status, when the engine rejects', async () => {
        const engine: DataEngineLike = {
            query: async () => {
                throw Object.assign(new Error('Forbidden'), {
                    details: { httpStatusCode: 403 },
                })
            },
            mutate: async () => ({}),
        }
        const result = await fetchTrackerEvent(
            createEventFormClient(engine),
            'x'
        )
        expect(result.isErr()).toBe(true)
        if (result.isErr()) {
            expect(result.error).toBeInstanceOf(EventFormApiError)
            expect(result.error.kind).toBe('request')
            expect(result.error.status).toBe(403)
        }
    })
})

describe('query options', () => {
    it('hand a failed Result to React Query as a thrown error', async () => {
        const { engine } = engineReturning({ event: 'x' })
        const options = trackerEventQueryOptions(
            createEventFormClient(engine),
            'x'
        )
        await expect(
            new QueryClient().fetchQuery(options)
        ).rejects.toBeInstanceOf(EventFormApiError)
    })

    it('never refetches the system calendar', () => {
        const { engine } = engineReturning(undefined)
        const options = systemCalendarQueryOptions(
            createEventFormClient(engine)
        )
        expect(options.staleTime).toBe(Number.POSITIVE_INFINITY)
        expect(options.queryKey).toEqual(eventFormKeys.systemInfo())
    })
})

describe('shouldRetryEventFormRequest', () => {
    const error = (kind: EventFormApiError['kind'], status?: number) =>
        new EventFormApiError(kind, 'x', undefined, status)

    it('retries server and network failures twice', () => {
        expect(shouldRetryEventFormRequest(0, error('request'))).toBe(true)
        expect(shouldRetryEventFormRequest(1, error('request', 503))).toBe(true)
        expect(shouldRetryEventFormRequest(2, error('request', 503))).toBe(
            false
        )
    })

    it('does not retry client errors or invalid responses', () => {
        expect(shouldRetryEventFormRequest(0, error('request', 404))).toBe(
            false
        )
        expect(shouldRetryEventFormRequest(0, error('invalid-response'))).toBe(
            false
        )
        expect(shouldRetryEventFormRequest(0, error('not-found'))).toBe(false)
    })
})
