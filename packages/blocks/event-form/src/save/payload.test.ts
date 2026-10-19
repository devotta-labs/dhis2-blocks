import { buildEventPayload } from './payload'

const RMNCH = {
    eventId: 'Evahwp3zrQ4',
    programId: 'WSGAb5XwJ3Y',
    programStageId: 'WZbXY0S00lP',
    enrollmentId: 'PE6abx7Zhn0',
}

describe('buildEventPayload', () => {
    it('builds the exact JSON for a new event', () => {
        const payload = buildEventPayload({
            ...RMNCH,
            trackedEntityId: 'TEabcdefgh1',
            status: 'ACTIVE',
            context: { occurredAt: '2026-03-12', orgUnitId: 'm7fBMpmVpSM' },
            effective: { vANAXwtLwcT: '20', NPZPVg2rVh4: 'false' },
            initialStored: {},
            note: {
                note: 'Nt0abcdefgh',
                value: 'Mother attended with partner',
            },
            isNew: true,
        })
        expect(payload).toStrictEqual({
            events: [
                {
                    event: 'Evahwp3zrQ4',
                    program: 'WSGAb5XwJ3Y',
                    programStage: 'WZbXY0S00lP',
                    enrollment: 'PE6abx7Zhn0',
                    trackedEntity: 'TEabcdefgh1',
                    orgUnit: 'm7fBMpmVpSM',
                    status: 'ACTIVE',
                    occurredAt: '2026-03-12',
                    dataValues: [
                        { dataElement: 'vANAXwtLwcT', value: '20' },
                        { dataElement: 'NPZPVg2rVh4', value: 'false' },
                    ],
                    notes: [
                        {
                            note: 'Nt0abcdefgh',
                            value: 'Mother attended with partner',
                        },
                    ],
                },
            ],
        })
    })

    it('sends only changed values, and cleared ones as null, on edit', () => {
        const payload = buildEventPayload({
            ...RMNCH,
            status: 'COMPLETED',
            context: {
                occurredAt: '2026-03-12T12:05:00.000',
                orgUnitId: 'm7fBMpmVpSM',
                geometry: { type: 'Point', coordinates: [-11.5, 8.5] },
            },
            effective: { b: '2', c: '4', d: '5' },
            initialStored: { a: '1', b: '2', c: '3' },
            isNew: false,
        })
        expect(payload).toStrictEqual({
            events: [
                {
                    event: 'Evahwp3zrQ4',
                    program: 'WSGAb5XwJ3Y',
                    programStage: 'WZbXY0S00lP',
                    enrollment: 'PE6abx7Zhn0',
                    orgUnit: 'm7fBMpmVpSM',
                    status: 'COMPLETED',
                    occurredAt: '2026-03-12',
                    geometry: { type: 'Point', coordinates: [-11.5, 8.5] },
                    // b is unchanged, so it is not sent: a value someone else changed is kept.
                    dataValues: [
                        { dataElement: 'c', value: '4' },
                        { dataElement: 'd', value: '5' },
                        { dataElement: 'a', value: null },
                    ],
                    notes: [],
                },
            ],
        })
    })

    it('does not send nulls for a new event', () => {
        const payload = buildEventPayload({
            ...RMNCH,
            status: 'ACTIVE',
            context: {},
            effective: {},
            initialStored: { a: '1' },
            isNew: true,
        })
        expect(payload.events[0].dataValues).toEqual([])
    })

    it('sends every effective value for a new event', () => {
        const payload = buildEventPayload({
            ...RMNCH,
            status: 'ACTIVE',
            context: {},
            effective: { a: '1', b: '2' },
            initialStored: { a: '1' },
            isNew: true,
        })
        expect(payload.events[0].dataValues).toEqual([
            { dataElement: 'a', value: '1' },
            { dataElement: 'b', value: '2' },
        ])
    })

    it('an unchanged edit sends no values', () => {
        const payload = buildEventPayload({
            ...RMNCH,
            status: 'ACTIVE',
            context: {},
            effective: { a: '1', orphan: 'kept' },
            initialStored: { a: '1', orphan: 'kept' },
            isNew: false,
        })
        expect(payload.events[0].dataValues).toEqual([])
    })

    it('is plain JSON', () => {
        const payload = buildEventPayload({
            ...RMNCH,
            status: 'ACTIVE',
            context: { occurredAt: '2026-03-12' },
            effective: { b: '3' },
            initialStored: { a: '1', b: '2' },
            note: { note: 'Nt0abcdefgh', value: 'n' },
            isNew: false,
        })
        expect(JSON.parse(JSON.stringify(payload))).toStrictEqual(payload)
    })
})
