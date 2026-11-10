import { recordIdOf } from '../model/types'
import type { PersonRecord } from '../model/types'
import type { OutboxRecord } from '../outbox/outbox'
import importEnrollmentRefused from './__tests__/fixtures/import-enrollment-refused.json'
import importPersonRefused from './__tests__/fixtures/import-person-refused.json'
import importUniqueClash from './__tests__/fixtures/import-unique-clash.json'
import {
    DELIVERY_PLACE,
    FIRST_NAME,
    IMPORTED,
    LAST_NAME,
    MANDATORY,
    NGELEHUN,
    PERSON_TYPE,
    PROGRAM,
    SOURCE,
    UNIQUE_ID,
    edit,
    newRow,
    recordsOf,
    registerForm,
    trackerEngine,
    typed,
} from './__tests__/trackerRig'
import {
    ENROLLMENT_LEVEL_FIELDS,
    EVENT_LEVEL_FIELDS,
    PERSON_LEVEL_FIELDS,
} from './eventSchemas'
import { trackerSaver } from './trackerSave'

const REFUSED = newRow({
    person: 'PsnRefused1',
    enrollment: 'EnrRefused1',
    anc1: 'EvtRefused1',
    anc2: 'EvtRefused2',
})

const outcomes = (
    records: ReadonlyArray<OutboxRecord>,
    result: string,
    reason?: string
) =>
    records.map(({ key }) => ({
        sourceKey: SOURCE,
        key,
        result,
        ...(reason !== undefined && { reason }),
    }))

/** DHIS2's message for its report of `code`. */
const messageOf = (
    report: {
        validationReport: {
            errorReports: Array<{
                errorCode: string
                uid: string
                message: string
            }>
        }
    },
    code: string,
    uid?: string
) =>
    report.validationReport.errorReports.find(
        (error) =>
            error.errorCode === code && (uid === undefined || error.uid === uid)
    )?.message

const of = (records: ReadonlyArray<OutboxRecord>, ...ids: string[]) =>
    records.filter(({ key }) => ids.includes(recordIdOf(key)))

test('reads what DHIS2 holds of each kind, people by their type, and imports them in one flat payload', async () => {
    const fake = trackerEngine({})
    const records = typed(REFUSED)
    await trackerSaver(SOURCE, PROGRAM).save(
        fake.engine,
        records,
        registerForm(recordsOf(REFUSED))
    )
    expect(fake.reads).toEqual([
        {
            resource: 'tracker/trackedEntities',
            params: {
                trackedEntityType: PERSON_TYPE,
                trackedEntities: 'PsnRefused1',
                fields: PERSON_LEVEL_FIELDS,
                pageSize: 1,
            },
        },
        {
            resource: 'tracker/enrollments',
            params: {
                program: PROGRAM,
                enrollments: 'EnrRefused1',
                fields: ENROLLMENT_LEVEL_FIELDS,
                pageSize: 1,
            },
        },
        {
            resource: 'tracker/events',
            params: {
                program: PROGRAM,
                events: 'EvtRefused1,EvtRefused2',
                fields: EVENT_LEVEL_FIELDS,
                pageSize: 2,
            },
        },
    ])
    expect(fake.mutations).toEqual([
        {
            resource: 'tracker',
            type: 'create',
            params: {
                async: false,
                importStrategy: 'CREATE_AND_UPDATE',
                atomicMode: 'OBJECT',
            },
            data: {
                trackedEntities: [
                    expect.objectContaining({ trackedEntity: 'PsnRefused1' }),
                ],
                enrollments: [
                    expect.objectContaining({ enrollment: 'EnrRefused1' }),
                ],
                events: [
                    expect.objectContaining({ event: 'EvtRefused1' }),
                    expect.objectContaining({ event: 'EvtRefused2' }),
                ],
            },
        },
    ])
})

test('a refused person keeps its enrolment and events waiting', async () => {
    // DHIS2 2.42 reports the person and its enrolment; the events are ignored with no report of their own.
    const fake = trackerEngine({}, [importPersonRefused])
    const records = typed(REFUSED, { birthDate: 'not-a-date' })
    expect(
        await trackerSaver(SOURCE, PROGRAM).save(
            fake.engine,
            records,
            registerForm(recordsOf(REFUSED))
        )
    ).toEqual([
        ...outcomes(
            of(records, 'PsnRefused1'),
            'waiting',
            messageOf(importPersonRefused, 'E1007')
        ),
        ...outcomes(
            of(records, 'EnrRefused1', 'EvtRefused1', 'EvtRefused2'),
            'waiting',
            'Waiting for the person to be saved'
        ),
    ])
})

test('a refused enrolment keeps its events waiting, and its person is saved', async () => {
    // Loaded before the program made Last name mandatory: DHIS2 refuses the enrolment and saves the person.
    const fake = trackerEngine({}, [importEnrollmentRefused])
    const row = newRow({
        person: 'PsnNoLastN1',
        enrollment: 'EnrNoLastN1',
        anc1: 'EvtNoLastN1',
        anc2: 'EvtNoLastN2',
    })
    const records = typed(row, { uniqueId: '8350217747' }).filter(
        ({ key }) => key !== `PsnNoLastN1.${LAST_NAME}`
    )
    const form = registerForm(
        recordsOf(row),
        MANDATORY.filter((attribute) => attribute !== LAST_NAME)
    )
    expect(
        await trackerSaver(SOURCE, PROGRAM).save(fake.engine, records, form)
    ).toEqual([
        ...outcomes(of(records, 'PsnNoLastN1'), 'saved'),
        ...outcomes(
            of(records, 'EnrNoLastN1'),
            'waiting',
            messageOf(importEnrollmentRefused, 'E1018')
        ),
        ...outcomes(
            of(records, 'EvtNoLastN1', 'EvtNoLastN2'),
            'waiting',
            'Waiting for the enrolment to be saved'
        ),
    ])
})

test('two people with one unique value are both refused on the attribute', async () => {
    const fake = trackerEngine({}, [importUniqueClash])
    const rows = ['A', 'B'].map((person) =>
        newRow({
            person: `PsnClash${person}01`,
            enrollment: `EnrClash${person}01`,
            anc1: `EvtClash${person}01`,
            anc2: `EvtClash${person}02`,
        })
    )
    const records = rows.flatMap((row) =>
        typed(row, { uniqueId: '8350217748' })
    )
    const saved = await trackerSaver(SOURCE, PROGRAM).save(
        fake.engine,
        records,
        registerForm(rows.flatMap(recordsOf))
    )
    // DHIS2's refusal sits on the Unique ID cell; the rest of each row waits for its person.
    expect(saved).toEqual(
        rows.flatMap(({ person, enrollment, anc1, anc2 }) =>
            of(records, person.id, enrollment.id, anc1.id, anc2.id).map(
                ({ key }) =>
                    key === `${person.id}.${UNIQUE_ID}`
                        ? {
                              sourceKey: SOURCE,
                              key,
                              result: 'waiting',
                              reason: messageOf(
                                  importUniqueClash,
                                  'E1064',
                                  person.id
                              ),
                          }
                        : {
                              sourceKey: SOURCE,
                              key,
                              result: 'waiting',
                              reason: 'Waiting for the person to be saved',
                          }
            )
        )
    )
    expect(messageOf(importUniqueClash, 'E1064')).toBe(
        'Non-unique attribute value `8350217748` for attribute `lZGmxYbs97q`.'
    )
})

test('a held person’s valid change waits while the clashing value fails', async () => {
    const woman: PersonRecord = {
        kind: 'trackedEntity',
        id: 'Y8aEiTpHSSQ',
        trackedEntityTypeId: PERSON_TYPE,
        orgUnitId: NGELEHUN,
    }
    // DHIS2's E1064, on this person.
    const clash = importUniqueClash.validationReport.errorReports.find(
        ({ uid }) => uid === 'PsnClashA01'
    )
    const fake = trackerEngine(
        {
            trackedEntities: [
                {
                    trackedEntity: woman.id,
                    trackedEntityType: PERSON_TYPE,
                    orgUnit: NGELEHUN,
                    inactive: false,
                },
            ],
        },
        [
            {
                ...importUniqueClash,
                validationReport: {
                    errorReports: [{ ...clash, uid: woman.id }],
                    warningReports: [],
                },
            },
        ]
    )
    const firstName = edit(woman, FIRST_NAME, 'Fatmata')
    const uniqueId = edit(woman, UNIQUE_ID, '8350217748')
    expect(
        await trackerSaver(SOURCE, PROGRAM).save(
            fake.engine,
            [firstName, uniqueId],
            registerForm([woman])
        )
    ).toEqual([
        ...outcomes(
            [firstName],
            'waiting',
            'Waiting for the person to be saved'
        ),
        ...outcomes([uniqueId], 'failed', clash?.message),
    ])
})

test('a person update sends back its possible-duplicate flag', async () => {
    const woman: PersonRecord = {
        kind: 'trackedEntity',
        id: 'Y8aEiTpHSSQ',
        trackedEntityTypeId: PERSON_TYPE,
        orgUnitId: NGELEHUN,
    }
    const fake = trackerEngine({
        trackedEntities: [
            {
                trackedEntity: woman.id,
                trackedEntityType: PERSON_TYPE,
                orgUnit: NGELEHUN,
                potentialDuplicate: true,
            },
        ],
    })
    await trackerSaver(SOURCE, PROGRAM).save(
        fake.engine,
        [edit(woman, FIRST_NAME, 'Fatmata')],
        registerForm([woman])
    )
    expect(fake.sent()[0].trackedEntities[0]).toMatchObject({
        potentialDuplicate: true,
    })
    expect(
        fake.reads.some((read) =>
            JSON.stringify(read).includes('potentialDuplicate')
        )
    ).toBe(true)
})

test('sending a refused person again creates all three with the same ids', async () => {
    const fake = trackerEngine({}, [importPersonRefused, IMPORTED])
    const saver = trackerSaver(SOURCE, PROGRAM)
    const form = registerForm(recordsOf(REFUSED))
    await saver.save(
        fake.engine,
        typed(REFUSED, { birthDate: 'not-a-date' }),
        form
    )
    // The birth date corrected; the rest of the row waits in the outbox as it was.
    const fixed = typed(REFUSED)
    expect(await saver.save(fake.engine, fixed, form)).toEqual(
        outcomes(fixed, 'saved')
    )
    const ids = (data: Record<string, Array<Record<string, string>>>) => [
        data.trackedEntities.map(({ trackedEntity }) => trackedEntity),
        data.enrollments.map(({ enrollment }) => enrollment),
        data.events.map(({ event }) => event),
    ]
    const [first, second] = fake.sent()
    expect(ids(second)).toEqual(ids(first))
    expect(ids(second)).toEqual([
        ['PsnRefused1'],
        ['EnrRefused1'],
        ['EvtRefused1', 'EvtRefused2'],
    ])
})

test('a value typed into a held scheduled visit with no date column reads its enrolment for the date', async () => {
    const enrolled = { ...REFUSED.enrollment, isNew: false }
    const birth = {
        ...REFUSED.birth,
        isNew: false,
        status: 'SCHEDULE' as const,
    }
    const fake = trackerEngine({
        events: [
            {
                event: birth.id,
                program: PROGRAM,
                programStage: birth.programStageId,
                orgUnit: NGELEHUN,
                enrollment: enrolled.id,
                scheduledAt: '2026-10-05T00:00:00.000',
                status: 'SCHEDULE',
            },
        ],
        enrollments: [
            {
                enrollment: enrolled.id,
                program: PROGRAM,
                trackedEntity: REFUSED.person.id,
                orgUnit: NGELEHUN,
                enrolledAt: '2026-10-05T00:00:00.000',
                status: 'ACTIVE',
            },
        ],
    })
    const place = edit(birth, DELIVERY_PLACE, 'Home')
    const saved = await trackerSaver(SOURCE, PROGRAM).save(
        fake.engine,
        [place],
        registerForm([enrolled, birth])
    )
    expect(saved).toEqual(outcomes([place], 'saved'))
    expect(fake.sent()).toEqual([
        {
            events: [
                expect.objectContaining({
                    event: birth.id,
                    status: 'ACTIVE',
                    occurredAt: '2026-10-05T00:00:00.000',
                }),
            ],
        },
    ])
})
