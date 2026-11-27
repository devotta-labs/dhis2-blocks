import { CHILD_VISIT, SAVED_VISIT } from '../test/childVisit'
import { formReducer, initialFormState, toSend } from './formState'
import { heldLocation } from './location'
import { heldEventSchema } from './metadata'
import { eventPayload, IMPORT_PARAMS } from './payload'
import type { PayloadInput } from './payload'

const NEW: PayloadInput = {
    eventId: 'newEvent001',
    programId: CHILD_VISIT.programId,
    programStageId: CHILD_VISIT.stageId,
    orgUnitId: 'otherUnit01',
    eventDate: '2026-11-12',
    status: 'ACTIVE',
    effective: { labWeight01: '12', labDoseMg01: '24' },
    opened: {},
}

const held = heldEventSchema.parse({
    ...SAVED_VISIT,
    attributeOptionCombo: 'labAoc00001',
    assignedUser: { uid: 'labUser0001', username: 'nurse' },
    followUp: true,
})

const POINT_NOW = JSON.stringify({
    type: 'Point',
    coordinates: [-13.2356, 8.4871],
})
const POINT_HELD = JSON.stringify(SAVED_VISIT.geometry)
const AREA = {
    type: 'Polygon',
    coordinates: [
        [
            [-12, 8],
            [-11, 8],
            [-11, 9],
            [-12, 8],
        ],
    ],
}

const EDIT: PayloadInput = {
    ...NEW,
    eventId: held.event,
    held,
    eventDate: '2026-11-02',
    effective: { labWeight01: '13', labSexCode1: 'F' },
    opened: { labWeight01: '12', labTempC001: '37.2', labSexCode1: 'F' },
}

describe('eventPayload', () => {
    it('imports synchronously, all or nothing', () => {
        expect(IMPORT_PARAMS).toEqual({
            async: false,
            importStrategy: 'CREATE_AND_UPDATE',
            atomicMode: 'ALL',
        })
    })

    it('sends a new event with every effective value', () => {
        expect(
            eventPayload({
                ...NEW,
                enrollmentId: 'labEnrol001',
                trackedEntityId: 'labPerson01',
            })
        ).toEqual({
            events: [
                {
                    event: 'newEvent001',
                    program: CHILD_VISIT.programId,
                    programStage: CHILD_VISIT.stageId,
                    orgUnit: 'otherUnit01',
                    enrollment: 'labEnrol001',
                    trackedEntity: 'labPerson01',
                    occurredAt: '2026-11-12',
                    status: 'ACTIVE',
                    dataValues: [
                        { dataElement: 'labWeight01', value: '12' },
                        { dataElement: 'labDoseMg01', value: '24' },
                    ],
                },
            ],
        })
    })

    it('reopens a completed event as active with its held fields and values, and nothing typed since', () => {
        const completed = heldEventSchema.parse({
            ...SAVED_VISIT,
            status: 'COMPLETED',
        })
        const state = formReducer(initialFormState(completed, '2026-11-12'), {
            type: 'committed',
            fieldId: 'labWeight01',
            value: '99',
        })
        const sent = toSend(state, 'reopen', { labWeight01: '99' })
        const [event] = eventPayload({
            ...EDIT,
            held: completed,
            status: sent.status,
            eventDate: sent.eventDate ?? '',
            effective: sent.effective,
            opened: state.opened.stored,
            note: sent.note,
        }).events
        expect(event).toMatchObject({
            event: completed.event,
            occurredAt: completed.occurredAt,
            status: 'ACTIVE',
        })
        expect(event?.dataValues).toEqual(
            completed.dataValues.map(({ dataElement, value }) => ({
                dataElement,
                value,
            }))
        )
        expect(event).not.toHaveProperty('notes')
    })

    it('leaves enrollment and tracked entity out when not given', () => {
        const [event] = eventPayload(NEW).events
        expect(event).not.toHaveProperty('enrollment')
        expect(event).not.toHaveProperty('trackedEntity')
    })

    it('sends an edited event’s own fields back, and nulls for cleared values', () => {
        const [event] = eventPayload(EDIT).events
        expect(event).toEqual({
            event: CHILD_VISIT.eventId,
            program: CHILD_VISIT.programId,
            programStage: CHILD_VISIT.stageId,
            orgUnit: CHILD_VISIT.orgUnitId,
            enrollment: CHILD_VISIT.enrollmentId,
            occurredAt: SAVED_VISIT.occurredAt,
            scheduledAt: SAVED_VISIT.scheduledAt,
            status: 'ACTIVE',
            followUp: true,
            geometry: SAVED_VISIT.geometry,
            attributeOptionCombo: 'labAoc00001',
            assignedUser: { uid: 'labUser0001', username: 'nurse' },
            dataValues: [
                { dataElement: 'labWeight01', value: '13' },
                { dataElement: 'labSexCode1', value: 'F' },
                { dataElement: 'labTempC001', value: null },
            ],
        })
    })

    it('sends a changed event date as the new day', () => {
        const [event] = eventPayload({
            ...EDIT,
            eventDate: '2026-11-03',
        }).events
        expect(event.occurredAt).toBe('2026-11-03')
    })

    it('saves a scheduled or overdue event as active, and completes', () => {
        expect(
            eventPayload({ ...EDIT, status: 'SCHEDULE' }).events[0].status
        ).toBe('ACTIVE')
        expect(
            eventPayload({ ...EDIT, status: 'OVERDUE' }).events[0].status
        ).toBe('ACTIVE')
        expect(
            eventPayload({ ...EDIT, status: 'COMPLETED' }).events[0].status
        ).toBe('COMPLETED')
    })

    it('sends a point stage’s location as a GeoJSON point, longitude first', () => {
        const [created] = eventPayload({
            ...NEW,
            location: { now: POINT_NOW, featureType: 'POINT' },
        }).events
        expect(created.geometry).toEqual({
            type: 'Point',
            coordinates: [-13.2356, 8.4871],
        })
        const [moved] = eventPayload({
            ...EDIT,
            location: {
                now: POINT_NOW,
                opened: POINT_HELD,
                featureType: 'POINT',
            },
        }).events
        expect(moved.geometry).toEqual({
            type: 'Point',
            coordinates: [-13.2356, 8.4871],
        })
    })

    it('sends an area as a polygon to a POLYGON stage, and as a multi-polygon of one part to a MULTI_POLYGON stage', () => {
        const [polygon] = eventPayload({
            ...NEW,
            location: { now: JSON.stringify(AREA), featureType: 'POLYGON' },
        }).events
        expect(polygon.geometry).toEqual(AREA)
        const [multi] = eventPayload({
            ...NEW,
            location: {
                now: JSON.stringify(AREA),
                featureType: 'MULTI_POLYGON',
            },
        }).events
        expect(multi.geometry).toEqual({
            type: 'MultiPolygon',
            coordinates: [AREA.coordinates],
        })
    })

    it('sends null for a location cleared after it was stored, and none when there never was one', () => {
        const [cleared] = eventPayload({
            ...EDIT,
            location: { opened: POINT_HELD, featureType: 'POINT' },
        }).events
        expect(cleared.geometry).toBeNull()
        const [created] = eventPayload({
            ...NEW,
            location: { featureType: 'POLYGON' },
        }).events
        expect(created).not.toHaveProperty('geometry')
    })

    it('sends a stored geometry left as it was back exactly, altitudes and all', () => {
        const stored = {
            type: 'MultiPolygon',
            coordinates: [
                [
                    [
                        [-11.1, 8.1, 120],
                        [-11.2, 8.2, 130],
                        [-11.1, 8.2, 125],
                        [-11.1, 8.1, 120],
                    ],
                ],
            ],
        }
        const opened = heldLocation(stored)
        const [kept] = eventPayload({
            ...EDIT,
            held: { ...held, geometry: stored },
            location: { now: opened, opened, featureType: 'MULTI_POLYGON' },
        }).events
        expect(kept.geometry).toEqual(stored)
    })

    it('sends a stored geometry the form cannot read back as it is', () => {
        const unread = { type: 'LineString', coordinates: [[-11, 8]] }
        const [edited] = eventPayload({
            ...EDIT,
            held: { ...held, geometry: unread },
            location: { featureType: 'POLYGON' },
        }).events
        expect(edited.geometry).toEqual(unread)
    })

    it('sends the chosen category options in order, without the held combination', () => {
        const [created] = eventPayload({
            ...NEW,
            categoryOptions: ['labCoGovt01', 'labCoFixed1'],
        }).events
        expect(created.attributeCategoryOptions).toBe('labCoGovt01,labCoFixed1')
        expect(created).not.toHaveProperty('attributeOptionCombo')

        const [edited] = eventPayload({
            ...EDIT,
            held: {
                ...held,
                attributeCategoryOptions: 'labCoGovt01,labCoFixed1',
            },
            categoryOptions: ['labCoNgo001', 'labCoFixed1'],
        }).events
        expect(edited.attributeCategoryOptions).toBe('labCoNgo001,labCoFixed1')
        expect(edited).not.toHaveProperty('attributeOptionCombo')
    })

    it('adds a typed note with its id, trimmed, and never sends the held notes back', () => {
        expect(held.notes).toHaveLength(2)
        const [edited] = eventPayload({
            ...EDIT,
            note: { id: 'labNoteNew1', text: ' Gave ORS. \n' },
        }).events
        expect(edited.notes).toEqual([
            { note: 'labNoteNew1', value: 'Gave ORS.' },
        ])
        const [blank] = eventPayload({
            ...EDIT,
            note: { id: 'labNoteNew1', text: '  ' },
        }).events
        expect(blank).not.toHaveProperty('notes')
    })
})
