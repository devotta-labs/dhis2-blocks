import rmnchEvents from './__tests__/fixtures/rmnch-person-events.json'
import rmnchProgram from './__tests__/fixtures/rmnch-program.json'
import {
    A,
    fakeEngine,
    INPATIENT,
    INPATIENT_LOAD,
    NGELEHUN,
    PERSON,
    PERSON_LOAD,
    PERSON_ORG_UNIT,
    RMNCH,
    SECOND_VISIT,
    VISIT,
} from './__tests__/saveRig'
import { EVENT_DATE_COLUMN } from './eventSchemas'
import { eventSource } from './eventSource'

const TODAY = '2026-10-26'
const CARE_AT_BIRTH = 'PFDfvmGpsR3'

const loadPerson = () =>
    eventSource({
        programId: RMNCH,
        orgUnitId: PERSON_ORG_UNIT,
        enrollmentId: PERSON,
        order: 'occurredAt:asc',
        today: TODAY,
    }).load(fakeEngine(PERSON_LOAD, []).engine)

const idsOf = (stages: typeof rmnchProgram.programStages) =>
    new Set(
        stages.flatMap(({ programStageDataElements }) =>
            programStageDataElements.map(({ dataElement }) => dataElement.id)
        )
    )

test('every row has an event record with its stage, org unit, enrolment and status', async () => {
    const form = await loadPerson()
    const event = rmnchEvents.events.find(({ event: id }) => id === VISIT)
    expect(event).toBeDefined()
    expect(form.records.get(VISIT)).toEqual({
        kind: 'event',
        id: VISIT,
        programStageId: SECOND_VISIT,
        orgUnitId: event?.orgUnit,
        enrollmentId: event?.enrollment,
        status: event?.status,
    })
    expect(form.records.size).toBe(form.tables[0].rows.length)
})

test('fields cover every stage of the program, shown or not, and the event date', async () => {
    const form = await loadPerson()
    const { programStages } = rmnchProgram
    const elsewhere = idsOf(
        programStages.filter(({ id }) => id !== CARE_AT_BIRTH)
    )
    const onlyAtBirth = [
        ...idsOf(programStages.filter(({ id }) => id === CARE_AT_BIRTH)),
    ].filter((id) => !elsewhere.has(id))

    expect(form.fields.get(EVENT_DATE_COLUMN)).toEqual({ valueType: 'DATE' })
    expect(form.fields.size).toBe(idsOf(programStages).size + 1)
    expect(onlyAtBirth.length).toBeGreaterThan(0)
    expect(onlyAtBirth.every((id) => form.fields.has(id))).toBe(true)
})

test('fieldsByForm lists each stage’s data elements', async () => {
    const ids = (await loadPerson()).fieldsByForm.get(SECOND_VISIT)
    expect(ids?.size).toBe(30)
    expect(ids?.has(EVENT_DATE_COLUMN)).toBe(false)
})

test('a scheduled event’s record carries its due day', async () => {
    const scheduled = {
        ...INPATIENT_LOAD.events.events[0],
        status: 'SCHEDULE',
        occurredAt: undefined,
        scheduledAt: '2026-11-02T00:00:00.000',
    }
    const loaded = {
        ...INPATIENT_LOAD,
        events: { events: [scheduled] },
    }
    const form = await eventSource({
        programId: INPATIENT,
        orgUnitId: NGELEHUN,
        today: TODAY,
    }).load(fakeEngine(loaded, []).engine)
    expect(form.records.get(A)).toMatchObject({ scheduledAt: '2026-11-02' })
})
