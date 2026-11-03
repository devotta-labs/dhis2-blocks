import type {
    EnrollmentRecord,
    EventRecord,
    PersonRecord,
} from '../model/types'
import {
    BIRTH_DATE,
    CITY,
    DELIVERY_PLACE,
    ENROLLED_AT,
    FIRST_NAME,
    FIRST_VISIT,
    GESTATIONAL_AGE,
    LAST_NAME,
    NGELEHUN,
    PERSON_TYPE,
    PROGRAM,
    SECOND_VISIT,
    SOURCE,
    UNIQUE_ID,
    edit,
    newRow,
    recordsOf,
    registerForm,
    typed,
} from './__tests__/trackerRig'
import { EVENT_DATE_COLUMN } from './eventSchemas'
import type {
    EnrollmentFields,
    EventFields,
    PersonFields,
} from './eventSchemas'
import { buildImport } from './trackerPayload'

const holding = ({
    events = [],
    enrollments = [],
    people = [],
}: {
    events?: EventFields[]
    enrollments?: EnrollmentFields[]
    people?: PersonFields[]
}) => ({
    events: new Map(events.map((event) => [event.event, event])),
    enrollments: new Map(
        enrollments.map((enrollment) => [enrollment.enrollment, enrollment])
    ),
    people: new Map(people.map((person) => [person.trackedEntity, person])),
})

const NOTHING_HELD = holding({})
const CONTEXT = { programId: PROGRAM }

// A woman DHIS2 holds, enrolled in the program, with a visit scheduled.
const WOMAN = 'Y8aEiTpHSSQ'
const ENROLMENT = 'PE6abx7Zhn0'
const ELSEWHERE = 'm7fBMpmVpSM'
const HELD_PERSON: PersonFields = {
    trackedEntity: WOMAN,
    trackedEntityType: PERSON_TYPE,
    orgUnit: ELSEWHERE,
    inactive: true,
    geometry: { type: 'Point', coordinates: [-11.42, 8.06] },
}
const PERSON: PersonRecord = {
    kind: 'trackedEntity',
    id: WOMAN,
    trackedEntityTypeId: PERSON_TYPE,
    orgUnitId: ELSEWHERE,
}
const HELD_ENROLLMENT: EnrollmentFields = {
    enrollment: ENROLMENT,
    program: PROGRAM,
    trackedEntity: WOMAN,
    orgUnit: ELSEWHERE,
    enrolledAt: '2027-03-08T12:05:00.000',
    occurredAt: '2027-03-01T00:00:00.000',
    status: 'COMPLETED',
    followUp: true,
}
const ENROLLMENT: EnrollmentRecord = {
    kind: 'enrollment',
    id: ENROLMENT,
    programId: PROGRAM,
    trackedEntityId: WOMAN,
    orgUnitId: ELSEWHERE,
    status: 'COMPLETED',
}
const SCHEDULED: EventFields = {
    event: 'EvtSchedul1',
    program: PROGRAM,
    programStage: SECOND_VISIT,
    orgUnit: ELSEWHERE,
    enrollment: ENROLMENT,
    scheduledAt: '2027-04-05T00:00:00.000',
    status: 'SCHEDULE',
}
const SCHEDULED_VISIT: EventRecord = {
    kind: 'event',
    id: SCHEDULED.event,
    programStageId: SECOND_VISIT,
    orgUnitId: ELSEWHERE,
    enrollmentId: ENROLMENT,
    status: 'SCHEDULE',
}

const ROW = newRow({
    person: 'PsnNew00001',
    enrollment: 'EnrNew00001',
    anc1: 'EvtNew00001',
    anc2: 'EvtNew00002',
})
const ROW_FORM = registerForm(recordsOf(ROW))

const waits = (
    records: ReadonlyArray<{ key: string }>,
    reason: string,
    result = 'waiting'
) => records.map(({ key }) => ({ sourceKey: SOURCE, key, result, reason }))

test('a person update sends the held person fields and only the changed attributes', () => {
    const cleared = edit(PERSON, LAST_NAME, null)
    const { payload, waiting } = buildImport(
        [
            edit(PERSON, FIRST_NAME, 'Fatmata'),
            edit(PERSON, CITY, null),
            cleared,
        ],
        registerForm([PERSON]),
        holding({ people: [HELD_PERSON] }),
        CONTEXT
    )
    expect(payload).toEqual({
        trackedEntities: [
            {
                ...HELD_PERSON,
                attributes: [
                    { attribute: FIRST_NAME, value: 'Fatmata' },
                    { attribute: CITY, value: null },
                ],
            },
        ],
        enrollments: [],
        events: [],
    })
    // A mandatory attribute is not cleared.
    expect(waiting).toEqual(waits([cleared], 'Last name is required', 'failed'))
})

test('an enrolment update sends the held status, occurredAt and followUp', () => {
    const { payload } = buildImport(
        [edit(ENROLLMENT, ENROLLED_AT, '2027-03-09')],
        registerForm([ENROLLMENT]),
        holding({ enrollments: [HELD_ENROLLMENT] }),
        CONTEXT
    )
    expect(payload).toEqual({
        trackedEntities: [],
        enrollments: [
            { ...HELD_ENROLLMENT, enrolledAt: '2027-03-09T12:05:00.000' },
        ],
        events: [],
    })
})

test('a new person, enrolment and visit go in one payload with attributes on the person', () => {
    const records = [...typed(ROW), edit(ROW.anc1, GESTATIONAL_AGE, '12')]
    const { payload, sent, waiting } = buildImport(
        records,
        ROW_FORM,
        NOTHING_HELD,
        CONTEXT
    )
    const visit = {
        program: PROGRAM,
        orgUnit: NGELEHUN,
        enrollment: ROW.enrollment.id,
        status: 'ACTIVE',
    }
    expect(payload).toEqual({
        trackedEntities: [
            {
                trackedEntity: ROW.person.id,
                trackedEntityType: PERSON_TYPE,
                orgUnit: NGELEHUN,
                attributes: [
                    { attribute: UNIQUE_ID, value: '8350217746' },
                    { attribute: FIRST_NAME, value: 'Fatmata' },
                    { attribute: LAST_NAME, value: 'Kamara' },
                    { attribute: BIRTH_DATE, value: '1990-01-15' },
                ],
            },
        ],
        enrollments: [
            {
                enrollment: ROW.enrollment.id,
                program: PROGRAM,
                trackedEntity: ROW.person.id,
                orgUnit: NGELEHUN,
                status: 'ACTIVE',
                enrolledAt: '2026-10-05',
                occurredAt: '2026-10-05',
            },
        ],
        events: [
            {
                ...visit,
                event: ROW.anc1.id,
                programStage: FIRST_VISIT,
                occurredAt: '2026-10-05',
                dataValues: [{ dataElement: GESTATIONAL_AGE, value: '12' }],
            },
            {
                ...visit,
                event: ROW.anc2.id,
                programStage: SECOND_VISIT,
                occurredAt: '2026-10-20',
                dataValues: [],
            },
        ],
    })
    expect(sent).toEqual(records)
    expect(waiting).toEqual([])
})

test('a new person waits for a mandatory attribute and keeps its enrolment and events back', () => {
    const records = typed(ROW).filter(
        ({ key }) => key !== `${ROW.person.id}.${LAST_NAME}`
    )
    const { payload, sent, waiting } = buildImport(
        records,
        ROW_FORM,
        NOTHING_HELD,
        CONTEXT
    )
    expect(payload).toEqual({
        trackedEntities: [],
        enrollments: [],
        events: [],
    })
    expect(sent).toEqual([])
    expect(waiting).toEqual(waits(records, 'Waiting for: Last name'))
})

test('a new person waits for its enrolment date, and is never sent alone', () => {
    const records = typed(ROW).filter(
        ({ key }) => key !== `${ROW.enrollment.id}.${ENROLLED_AT}`
    )
    const { payload, waiting } = buildImport(
        records,
        ROW_FORM,
        NOTHING_HELD,
        CONTEXT
    )
    expect(payload).toEqual({
        trackedEntities: [],
        enrollments: [],
        events: [],
    })
    const [person, visits] = [
        records.filter(({ key }) => key.startsWith(ROW.person.id)),
        records.filter(({ key }) => !key.startsWith(ROW.person.id)),
    ]
    expect(waiting).toEqual([
        ...waits(person, 'Waiting for: Date of enrolment'),
        ...waits(visits, 'Waiting for the enrolment to be saved'),
    ])
})

test('values typed before a visit’s date wait with it', () => {
    // A new visit: the person and enrolment go, the undated visit waits.
    const undated = edit(ROW.anc2, GESTATIONAL_AGE, '20')
    const records = [
        ...typed(ROW).filter(({ key }) => !key.startsWith(ROW.anc2.id)),
        undated,
    ]
    const fresh = buildImport(records, ROW_FORM, NOTHING_HELD, CONTEXT)
    expect(fresh.payload.events).toEqual([
        expect.objectContaining({ event: ROW.anc1.id }),
    ])
    expect(fresh.waiting).toEqual(
        waits([undated], 'Waiting for required fields: ANC 2 date')
    )

    // A scheduled visit holds no values until its date: then both go in one update.
    const form = registerForm([SCHEDULED_VISIT])
    const held = holding({ events: [SCHEDULED] })
    const value = edit(SCHEDULED_VISIT, GESTATIONAL_AGE, '20')
    const early = buildImport([value], form, held, CONTEXT)
    expect(early.payload.events).toEqual([])
    expect(early.waiting).toEqual(
        waits([value], 'Waiting for required fields: Event date')
    )
    const date = edit(SCHEDULED_VISIT, EVENT_DATE_COLUMN, '2027-04-06')
    const dated = buildImport([value, date], form, held, CONTEXT)
    expect(dated.payload.events).toEqual([
        {
            ...SCHEDULED,
            status: 'ACTIVE',
            occurredAt: '2027-04-06',
            dataValues: [{ dataElement: GESTATIONAL_AGE, value: '20' }],
        },
    ])
    expect(dated.waiting).toEqual([])
})

test('a scheduled event given a date is sent ACTIVE with its scheduledAt', () => {
    const { payload } = buildImport(
        [edit(SCHEDULED_VISIT, EVENT_DATE_COLUMN, '2027-04-06')],
        registerForm([SCHEDULED_VISIT]),
        holding({ events: [SCHEDULED] }),
        CONTEXT
    )
    expect(payload.events).toEqual([
        {
            ...SCHEDULED,
            status: 'ACTIVE',
            occurredAt: '2027-04-06',
            scheduledAt: '2027-04-05T00:00:00.000',
            dataValues: [],
        },
    ])
})

test('a new enrolment’s scheduled events go in its import, once each', () => {
    const scheduled = (
        enrollment: EnrollmentRecord,
        stage: string,
        event: string
    ) => ({
        event,
        program: PROGRAM,
        programStage: stage,
        orgUnit: NGELEHUN,
        enrollment: enrollment.id,
        status: 'SCHEDULE',
        scheduledAt: '2026-11-02',
    })
    const asked: unknown[] = []
    const { payload } = buildImport(typed(ROW), ROW_FORM, NOTHING_HELD, {
        ...CONTEXT,
        scheduledEvents: (enrollment, enrolledAt, form) => {
            asked.push([enrollment, enrolledAt, form])
            return [
                scheduled(enrollment, SECOND_VISIT, ROW.anc2.id),
                scheduled(enrollment, 'bbKtnxRZKEP', 'EvtPostpar1'),
            ]
        },
    })
    expect(asked).toEqual([[ROW.enrollment, '2026-10-05', ROW_FORM]])
    // The typed visit fills the scheduled slot: it is created once, dated, keeping its due date.
    expect(payload.events).toEqual([
        expect.objectContaining({ event: ROW.anc1.id }),
        expect.objectContaining({
            event: ROW.anc2.id,
            status: 'ACTIVE',
            occurredAt: '2026-10-20',
            scheduledAt: '2026-11-02',
        }),
        scheduled(ROW.enrollment, 'bbKtnxRZKEP', 'EvtPostpar1'),
    ])
})

test('a visit in a slot with no date column takes the enrolment date', () => {
    const { payload } = buildImport(
        [...typed(ROW), edit(ROW.birth, DELIVERY_PLACE, 'Home')],
        registerForm(recordsOf(ROW)),
        NOTHING_HELD,
        CONTEXT
    )
    expect(payload.events.at(-1)).toMatchObject({
        event: ROW.birth.id,
        occurredAt: '2026-10-05',
        dataValues: [{ dataElement: DELIVERY_PLACE, value: 'Home' }],
    })
})

test('a held visit’s waits and refusals name the cell by its slot’s column', () => {
    const visit: EventRecord = { ...SCHEDULED_VISIT, slot: 'anc2#1' }
    const value = edit(visit, GESTATIONAL_AGE, '20')
    const held = holding({
        events: [
            SCHEDULED,
            { ...SCHEDULED, event: 'EvtVisited1', occurredAt: '2027-04-06' },
        ],
    })
    const dated: EventRecord = { ...visit, id: 'EvtVisited1' }
    const cleared = edit(dated, EVENT_DATE_COLUMN, null)
    const { waiting } = buildImport(
        [value, cleared],
        registerForm([visit, dated]),
        held,
        CONTEXT
    )
    expect(waiting).toEqual([
        ...waits([value], 'Waiting for required fields: ANC 2 date'),
        ...waits([cleared], 'ANC 2 date is required', 'failed'),
    ])
})

test('a change to anything but an enrolment’s dates is refused, never reported saved', () => {
    const status = edit(ENROLLMENT, 'status', 'CANCELLED')
    const { payload, sent, waiting } = buildImport(
        [status],
        registerForm([ENROLLMENT]),
        holding({ enrollments: [HELD_ENROLLMENT] }),
        CONTEXT
    )
    expect(payload.enrollments).toEqual([])
    expect(sent).toEqual([])
    expect(waiting).toEqual(
        waits([status], 'status cannot be saved on an enrolment', 'failed')
    )
})
