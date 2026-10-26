import inpatientEvents from './__tests__/fixtures/inpatient-events.json'
import inpatientProgram from './__tests__/fixtures/inpatient-program.json'
import rmnchEvents from './__tests__/fixtures/rmnch-person-events.json'
import rmnchProgram from './__tests__/fixtures/rmnch-program.json'
import {
    A,
    ADMISSION,
    AGE,
    DIAGNOSIS,
    DISCHARGE,
    EVENT_A,
    GESTATIONAL_AGE,
    HEIGHT,
    INPATIENT_IDS,
    INPATIENT_LOAD,
    LATER_VISIT,
    MODE_OF_DISCHARGE,
    NEW,
    NEW_INPATIENT,
    NEW_VISIT,
    PERSON,
    PERSON_LOAD,
    PERSON_ORG_UNIT,
    RMNCH,
    SECOND_VISIT,
    SOURCE,
    VISIT,
    change,
    inpatient,
    inpatientSource,
    openGrid,
    person,
    saved,
} from './__tests__/saveRig'
import { EVENT_DATE_COLUMN } from './eventSchemas'
import { eventSource } from './eventSource'

const NEW_VISIT_EVENT = {
    event: NEW,
    program: RMNCH,
    programStage: SECOND_VISIT,
    orgUnit: PERSON_ORG_UNIT,
    enrollment: PERSON,
    status: 'ACTIVE',
}

test('an update sends only the changed values, with null for a deletion', async () => {
    const grid = await inpatient()
    await grid.save(change(A, AGE, '6'), change(A, HEIGHT, null))
    expect(grid.sent()).toEqual([
        {
            ...EVENT_A,
            dataValues: [
                { dataElement: AGE, value: '6' },
                { dataElement: HEIGHT, value: null },
            ],
        },
    ])
})

test('a changed event date keeps the time of day', async () => {
    const grid = await person()
    await grid.save(change(VISIT, EVENT_DATE_COLUMN, '2026-04-15'))
    await grid.save(change(LATER_VISIT, GESTATIONAL_AGE, '20'))
    expect(
        grid.sent().map(({ event, occurredAt }) => [event, occurredAt])
    ).toEqual([
        [VISIT, '2026-04-15T12:05:00.000'],
        [LATER_VISIT, '2026-04-18T12:05:00.000'],
    ])
})

test('builds every update from what DHIS2 holds now, not the loaded form', async () => {
    // Loaded while A was open; it has been completed since.
    const stale = {
        ...INPATIENT_LOAD,
        events: {
            ...inpatientEvents,
            events: inpatientEvents.events.map((event) =>
                event.event === A ? { ...event, status: 'ACTIVE' } : event
            ),
        },
    }
    const grid = await openGrid(
        inpatientSource(),
        stale,
        inpatientEvents.events
    )
    await grid.save(change(A, AGE, '6'))
    expect(grid.sent()[0].status).toBe('COMPLETED')
})

test('every update sends back the event fields DHIS2 would otherwise erase', async () => {
    const placed = {
        geometry: { type: 'Point', coordinates: [-11.42, 8.06] },
        scheduledAt: '2026-12-20T08:15:00.000',
        assignedUser: {
            uid: 'ObaborECU7w',
            username: 'milla',
            displayName: 'Roger Milla',
        },
    }
    const grid = await openGrid(
        inpatientSource(),
        INPATIENT_LOAD,
        inpatientEvents.events.map((event) =>
            event.event === A ? { ...event, ...placed } : event
        )
    )
    await grid.save(change(A, AGE, '6'))
    await grid.setStatus(A, 'ACTIVE')
    const kept = expect.objectContaining({
        geometry: placed.geometry,
        scheduledAt: placed.scheduledAt,
        assignedUser: { uid: 'ObaborECU7w' },
        attributeOptionCombo: 'HllvX50cXC0',
    })
    expect(grid.sent()).toEqual([kept, kept])
})

test('a new row whose event DHIS2 already has is sent as an update', async () => {
    // Its create was saved, but the answer was lost.
    const created = {
        ...NEW_VISIT_EVENT,
        occurredAt: '2026-10-26T00:00:00.000',
    }
    const grid = await person([...rmnchEvents.events, created])
    const later = change(NEW, GESTATIONAL_AGE, '21', NEW_VISIT)
    expect(await grid.save(later)).toEqual([saved(later)])
    expect(grid.sent()).toEqual([
        {
            ...NEW_VISIT_EVENT,
            occurredAt: '2026-10-26T00:00:00.000',
            dataValues: [{ dataElement: GESTATIONAL_AGE, value: '21' }],
        },
    ])
})

test('a new event waits for its required fields in an ON_UPDATE_AND_INSERT stage', async () => {
    const grid = await inpatient()
    const records = [
        change(NEW, EVENT_DATE_COLUMN, '2026-10-26', NEW_INPATIENT),
        change(NEW, AGE, '6', NEW_INPATIENT),
    ]
    const reason =
        'Waiting for required fields: Date of admission, Date of discharge, Mode of Discharge, Diagnosis (ICD-10)'
    expect(await grid.save(...records)).toEqual(
        records.map(({ key }) => ({
            sourceKey: SOURCE,
            key,
            result: 'waiting',
            reason,
        }))
    )
    expect(grid.sent()).toEqual([])

    await grid.save(
        ...records,
        change(NEW, ADMISSION, '2026-10-20', NEW_INPATIENT),
        change(NEW, DISCHARGE, '2026-10-25', NEW_INPATIENT),
        change(NEW, MODE_OF_DISCHARGE, 'MODDISCH', NEW_INPATIENT),
        change(NEW, DIAGNOSIS, 'W42', NEW_INPATIENT)
    )
    expect(grid.sent()).toEqual([
        {
            event: NEW,
            ...INPATIENT_IDS,
            occurredAt: '2026-10-26',
            status: 'ACTIVE',
            dataValues: [
                { dataElement: AGE, value: '6' },
                { dataElement: ADMISSION, value: '2026-10-20' },
                { dataElement: DISCHARGE, value: '2026-10-25' },
                { dataElement: MODE_OF_DISCHARGE, value: 'MODDISCH' },
                { dataElement: DIAGNOSIS, value: 'W42' },
            ],
        },
    ])
})

test('a new event waits for its event date in every stage', async () => {
    const inpatientGrid = await inpatient()
    const inpatientOutcomes = await inpatientGrid.save(
        change(NEW, AGE, '6', NEW_INPATIENT)
    )
    expect(inpatientOutcomes.map(({ reason }) => reason)).toEqual([
        'Waiting for required fields: Event date, Date of admission, Date of discharge, Mode of Discharge, Diagnosis (ICD-10)',
    ])

    const personGrid = await person()
    const visitOutcomes = await personGrid.save(
        change(NEW, GESTATIONAL_AGE, '20', NEW_VISIT),
        change(NEW, EVENT_DATE_COLUMN, null, NEW_VISIT)
    )
    expect(personGrid.sent()).toEqual([])
    expect(visitOutcomes.map(({ result, reason }) => [result, reason])).toEqual(
        [
            ['waiting', 'Waiting for required fields: Event date'],
            ['waiting', 'Waiting for required fields: Event date'],
        ]
    )
})

test('a new event in an ON_COMPLETE stage is sent with what it has', async () => {
    const grid = await person()
    await grid.save(
        change(NEW, EVENT_DATE_COLUMN, '2026-10-26', NEW_VISIT),
        change(NEW, GESTATIONAL_AGE, '20', NEW_VISIT)
    )
    expect(grid.sent()).toEqual([
        {
            ...NEW_VISIT_EVENT,
            occurredAt: '2026-10-26',
            dataValues: [{ dataElement: GESTATIONAL_AGE, value: '20' }],
        },
    ])
})

test('a new tracker event joins its enrollment', async () => {
    const grid = await person()
    await grid.save(change(NEW, EVENT_DATE_COLUMN, '2026-10-26', NEW_VISIT))
    expect(grid.sent()[0].enrollment).toBe(PERSON)
})

test('clearing a required value is refused before sending', async () => {
    const grid = await inpatient()
    const cleared = change(A, ADMISSION, null)
    expect(await grid.save(cleared)).toEqual([
        {
            sourceKey: SOURCE,
            key: cleared.key,
            result: 'failed',
            reason: 'Date of admission is required',
        },
    ])
    expect(grid.mutations).toEqual([])

    // The event's other changes are still sent.
    const outcomes = await grid.save(cleared, change(A, AGE, '6'))
    expect(outcomes.map(({ result }) => result)).toEqual(['failed', 'saved'])
    expect(grid.sent().map(({ dataValues }) => dataValues)).toEqual([
        [{ dataElement: AGE, value: '6' }],
    ])
})

test('an ON_COMPLETE stage requires its fields once the event is completed', async () => {
    // Gestational age made compulsory in the second visit stage, which checks on completion.
    const program = {
        ...rmnchProgram,
        programStages: rmnchProgram.programStages.map((stage) => ({
            ...stage,
            programStageDataElements: stage.programStageDataElements.map(
                (element) => ({
                    ...element,
                    compulsory:
                        element.compulsory ||
                        element.dataElement.id === GESTATIONAL_AGE,
                })
            ),
        })),
    }
    const completed = rmnchEvents.events.map((event) =>
        event.event === VISIT ? { ...event, status: 'COMPLETED' } : event
    )
    const grid = await openGrid(
        eventSource({
            programId: RMNCH,
            orgUnitId: PERSON_ORG_UNIT,
            enrollmentId: PERSON,
        }),
        { ...PERSON_LOAD, program },
        completed
    )
    const outcomes = await grid.save(
        change(VISIT, GESTATIONAL_AGE, null),
        change(LATER_VISIT, GESTATIONAL_AGE, null)
    )
    expect(outcomes.map(({ result, reason }) => [result, reason])).toEqual([
        ['failed', 'Gestational age at visit is required'],
        ['saved', undefined],
    ])
    expect(grid.sent().map(({ event }) => event)).toEqual([LATER_VISIT])
})

test('clearing the event date of an event is refused before sending', async () => {
    const grid = await inpatient()
    const outcomes = await grid.save(
        change(A, EVENT_DATE_COLUMN, null),
        change(A, AGE, '6')
    )
    expect(outcomes.map(({ result, reason }) => [result, reason])).toEqual([
        ['failed', 'Event date is required'],
        ['saved', undefined],
    ])
    expect(grid.sent()[0].occurredAt).toBe('2026-12-25T00:00:00.000')
})

test('names fields as DHIS2 shows them', async () => {
    const program = {
        ...inpatientProgram,
        programStages: inpatientProgram.programStages.map((stage) => ({
            ...stage,
            programStageDataElements: stage.programStageDataElements.map(
                (element) =>
                    element.dataElement.id === ADMISSION
                        ? {
                              ...element,
                              dataElement: {
                                  ...element.dataElement,
                                  displayFormName:
                                      'Admission date / time & place',
                              },
                          }
                        : element
            ),
        })),
    }
    const grid = await openGrid(
        inpatientSource(),
        { ...INPATIENT_LOAD, program },
        inpatientEvents.events
    )
    const [outcome] = await grid.save(change(A, ADMISSION, null))
    expect(outcome.reason).toBe('Admission date / time & place is required')
})

test('leaves the changes of events DHIS2 does not hold', async () => {
    const grid = await inpatient()
    expect(await grid.save(change('Zz9yX8wV7uT', AGE, '6'))).toEqual([])
    expect(grid.mutations).toEqual([])
})
