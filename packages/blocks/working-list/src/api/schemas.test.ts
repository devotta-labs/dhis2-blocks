import {
    DeleteMutationResponseSchema,
    EventsResponseSchema,
    TrackedEntitiesResponseSchema,
    normalizeEventsResponse,
    normalizeTrackedEntitiesResponse,
} from './schemas'

const trackedEntity = {
    trackedEntity: 'TrackedEnt1',
    attributes: [],
    programOwners: [],
}

const event = {
    event: 'Event000001',
    status: 'ACTIVE' as const,
    program: 'Program0001',
    orgUnit: 'OrgUnit0001',
    dataValues: [],
}

describe('Tracker collection response boundaries', () => {
    it('normalizes canonical and legacy tracked-entity collections', () => {
        expect(
            normalizeTrackedEntitiesResponse(
                TrackedEntitiesResponseSchema.parse({
                    trackedEntities: [trackedEntity],
                })
            ).trackedEntities
        ).toEqual([trackedEntity])
        expect(
            normalizeTrackedEntitiesResponse(
                TrackedEntitiesResponseSchema.parse({
                    instances: [trackedEntity],
                })
            ).trackedEntities
        ).toEqual([trackedEntity])
    })

    it('does not let valid legacy data hide a malformed canonical TE key', () => {
        expect(() =>
            TrackedEntitiesResponseSchema.parse({
                trackedEntities: [{ attributes: [], programOwners: [] }],
                instances: [trackedEntity],
            })
        ).toThrow()
    })

    it('normalizes canonical and legacy event collections', () => {
        expect(
            normalizeEventsResponse(
                EventsResponseSchema.parse({ events: [event] })
            ).events
        ).toEqual([event])
        expect(
            normalizeEventsResponse(
                EventsResponseSchema.parse({ instances: [event] })
            ).events
        ).toEqual([event])
    })

    it('drops data values the server returns without a value', () => {
        // DHIS2 2.44 returns an empty data value as { dataElement } with no value.
        const parsed = EventsResponseSchema.parse({
            events: [
                {
                    ...event,
                    dataValues: [
                        { dataElement: 'DataElem001', value: '12' },
                        { dataElement: 'DataElem002' },
                        { dataElement: 'DataElem003', value: null },
                    ],
                },
            ],
        })
        expect(normalizeEventsResponse(parsed).events[0]?.dataValues).toEqual([
            { dataElement: 'DataElem001', value: '12' },
        ])
    })

    it('does not let valid legacy data hide a malformed canonical event key', () => {
        expect(() =>
            EventsResponseSchema.parse({
                events: [{ ...event, status: 'NOT_A_STATUS' }],
                instances: [event],
            })
        ).toThrow()
    })

    it('requires one recognized collection key', () => {
        expect(() => TrackedEntitiesResponseSchema.parse({})).toThrow()
        expect(() => EventsResponseSchema.parse({})).toThrow()
    })
})

describe('delete mutation response boundary', () => {
    it('accepts successful metadata responses and 204/no-content responses', () => {
        expect(DeleteMutationResponseSchema.parse({ status: 'OK' })).toEqual({
            status: 'OK',
        })
        expect(DeleteMutationResponseSchema.parse(undefined)).toBeUndefined()
    })

    it('rejects permissive or unsuccessful delete response objects', () => {
        expect(() => DeleteMutationResponseSchema.parse({})).toThrow()
        expect(() =>
            DeleteMutationResponseSchema.parse({ status: 'ERROR' })
        ).toThrow()
    })
})
