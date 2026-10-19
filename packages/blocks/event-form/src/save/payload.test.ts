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
            noteDraft: '  Mother attended with partner  ',
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
                    notes: [{ value: 'Mother attended with partner' }],
                },
            ],
        })
    })

    it('sends a cleared value as null on edit', () => {
        const payload = buildEventPayload({
            ...RMNCH,
            status: 'COMPLETED',
            context: {
                occurredAt: '2026-03-12T12:05:00.000',
                orgUnitId: 'm7fBMpmVpSM',
                geometry: { type: 'Point', coordinates: [-11.5, 8.5] },
            },
            effective: { b: '2' },
            initialStored: { a: '1', b: '2' },
            noteDraft: '   ',
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
                    dataValues: [
                        { dataElement: 'b', value: '2' },
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
            noteDraft: '',
            isNew: true,
        })
        expect(payload.events[0].dataValues).toEqual([])
    })

    it('is plain JSON', () => {
        const payload = buildEventPayload({
            ...RMNCH,
            status: 'ACTIVE',
            context: { occurredAt: '2026-03-12' },
            effective: { b: '2' },
            initialStored: { a: '1', b: '2' },
            noteDraft: 'n',
            isNew: false,
        })
        expect(JSON.parse(JSON.stringify(payload))).toStrictEqual(payload)
    })
})
