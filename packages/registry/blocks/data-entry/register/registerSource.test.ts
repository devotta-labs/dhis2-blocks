import { describe, expect, test } from 'vitest'
import { cellKey, keyOf, recordsOf } from '../model/types'
import immunisation from './__tests__/fixtures/immunisation-program.json'
import rmnch from './__tests__/fixtures/rmnch-register-program.json'
import {
    BCG,
    BIRTH_DATE,
    DOSE,
    DPT_1,
    ENROLLED_AT,
    FIRST_NAME,
    LAST_NAME,
    LAYOUT,
    NGELEHUN,
    OPV_1,
    PERSON_TYPE,
    PROGRAM,
    VACCINATION,
    VACCINE,
    edit,
    engineFor,
    enrolledAs,
    immunisationRegister,
} from './__tests__/registerRig'
import type { OutboxRecord } from '../outbox/outbox'
import { EVENT_DATE_COLUMN } from '../sources/eventSchemas'
import type { NewRow } from '../sources/types'
import type { RegisterLayout } from './layout'

describe('loading', () => {
    test('loads one row per enrolment with attributes, enrolment date and filled slots', async () => {
        const form = await immunisationRegister().load(engineFor().engine)
        const [table] = form.tables
        expect(form.rowKind).toBe('person')
        expect(table.rows.map(({ id }) => id)).toEqual([
            'ImmEnr00010',
            'ImmEnr00020',
            'ImmEnr00030',
        ])
        const [amara, musa] = table.rows
        expect(amara).toMatchObject({
            label: 'Amara Kamara',
            labelFrom: [
                cellKey('ImmTei00010', FIRST_NAME),
                cellKey('ImmTei00010', LAST_NAME),
            ],
            slots: {
                person: 'ImmTei00010',
                enrollment: 'ImmEnr00010',
                [BCG]: 'ImmEvt00001',
                [OPV_1]: 'ImmEvt00002',
            },
        })
        // Musa's events come in no set order; each fills the slot whose values it holds.
        expect(musa.slots).toMatchObject({
            [BCG]: 'ImmEvt00003',
            [OPV_1]: 'ImmEvt00004',
            [DPT_1]: 'ImmEvt00005',
        })
        expect(
            Object.fromEntries(
                table.columns.map((column) => [
                    column.label,
                    form.values.get(keyOf(amara, column)),
                ])
            )
        ).toEqual({
            'First name': 'Amara',
            'Last name': 'Kamara',
            'Birth date': '2026-09-28',
            Registered: '2026-10-02',
            'BCG 0': '2026-10-02',
            'OPV 1': '2026-10-16',
            'DPT 1': undefined,
            'DPT 2': undefined,
        })
        expect(form.records.get('ImmTei00010')).toEqual({
            kind: 'trackedEntity',
            id: 'ImmTei00010',
            trackedEntityTypeId: PERSON_TYPE,
            orgUnitId: NGELEHUN,
        })
        expect(form.records.get('ImmEnr00010')).toEqual({
            kind: 'enrollment',
            id: 'ImmEnr00010',
            programId: PROGRAM,
            trackedEntityId: 'ImmTei00010',
            orgUnitId: NGELEHUN,
            status: 'ACTIVE',
        })
        expect(form.records.get('ImmEvt00001')).toEqual({
            kind: 'event',
            id: 'ImmEvt00001',
            programStageId: VACCINATION,
            orgUnitId: NGELEHUN,
            enrollmentId: 'ImmEnr00010',
            status: 'COMPLETED',
            slot: BCG,
        })
        // The person's form holds every program attribute; the enrolment's its date.
        expect(form.fieldsByForm.get(PERSON_TYPE)).toEqual(
            new Set([FIRST_NAME, LAST_NAME, BIRTH_DATE, 'cejWyOfXge6'])
        )
        expect(form.required.get(PERSON_TYPE)).toEqual(
            new Set([FIRST_NAME, LAST_NAME, BIRTH_DATE])
        )
        expect(form.fieldsByForm.get(PROGRAM)).toEqual(new Set([ENROLLED_AT]))
        expect(form.required.get(PROGRAM)).toEqual(new Set([ENROLLED_AT]))
        expect(form.fieldsByForm.get(VACCINATION)).toEqual(
            new Set([VACCINE, DOSE])
        )
        expect(form.fieldNames.get('cejWyOfXge6')).toBe('Gender')
        expect(form.fieldNames.get(VACCINE)).toBe('Vaccine')
        expect(form.fields.get(ENROLLED_AT)).toEqual({ valueType: 'DATE' })
        expect(form.hasMore).toBe(false)
    })

    test('empty slots get new event records with their slot', async () => {
        const form = await immunisationRegister().load(engineFor().engine)
        const [amara] = form.tables[0].rows
        const id = amara.slots?.[DPT_1] ?? ''
        expect(id).toMatch(/^[A-Za-z][A-Za-z\d]{10}$/)
        expect(form.records.get(id)).toEqual({
            kind: 'event',
            id,
            programStageId: VACCINATION,
            orgUnitId: NGELEHUN,
            enrollmentId: 'ImmEnr00010',
            status: 'ACTIVE',
            isNew: true,
            slot: DPT_1,
            createdWith: { [VACCINE]: 'DPT', [DOSE]: '1' },
        })
        const ids = form.tables[0].rows.flatMap(recordsOf)
        expect(new Set(ids).size).toBe(ids.length)
        expect(ids.every((each) => form.records.has(each))).toBe(true)
    })

    test('events the register leaves out are noted on the enrolment’s row', async () => {
        const firstVisit: RegisterLayout = {
            ...LAYOUT,
            columns: [
                ...LAYOUT.columns.slice(0, 2),
                {
                    field: {
                        stage: VACCINATION,
                        occurrence: 1,
                        eventDate: true,
                    },
                },
            ],
        }
        const form = await immunisationRegister({ layout: firstVisit }).load(
            engineFor().engine
        )
        expect(form.rowNotes).toEqual(
            new Map([
                [
                    'ImmEnr00010',
                    ['1 more visits of Vaccination not in this register'],
                ],
                [
                    'ImmEnr00020',
                    ['2 more visits of Vaccination not in this register'],
                ],
            ])
        )
    })

    test('the enrolments query asks for the period, oldest first, with orgUnits', async () => {
        const fake = engineFor()
        await immunisationRegister().load(fake.engine)
        const [load] = fake.requests
        expect(load.enrollments).toEqual({
            resource: 'tracker/enrollments',
            params: {
                program: PROGRAM,
                orgUnits: NGELEHUN,
                orgUnitMode: 'SELECTED',
                enrolledAfter: '2026-10-01',
                enrolledBefore: '2026-10-31',
                order: 'enrolledAt:asc',
                pageSize: 25,
                fields: 'enrollment,trackedEntity,orgUnit,enrolledAt,occurredAt,status,attributes[attribute,value],events[event,enrollment,programStage,orgUnit,occurredAt,scheduledAt,completedAt,status,dataValues[dataElement,value]]',
            },
        })
        const next = engineFor({ enrollments: { enrollments: [] } })
        await immunisationRegister().loadPage?.(next.engine, 2)
        expect(next.requests[0].enrollments.params).toMatchObject({ page: 2 })
    })

    test('a layout that does not compile rejects the load with its errors', async () => {
        const broken: RegisterLayout = {
            programId: PROGRAM,
            columns: [{ field: { attribute: 'NoSuchAttr1' } }],
        }
        await expect(
            immunisationRegister({ layout: broken }).load(engineFor().engine)
        ).rejects.toThrow(
            'Column "NoSuchAttr1": the program has no field NoSuchAttr1; The layout leaves out First name, which a new row cannot be saved without'
        )
    })
})

describe('read-only', () => {
    test('a cancelled enrolment’s row is read-only', async () => {
        const form = await immunisationRegister().load(
            engineFor({
                enrollments: enrolledAs((enrollment, at) =>
                    at === 2
                        ? { ...enrollment, status: 'CANCELLED' }
                        : enrollment
                ),
            }).engine
        )
        const [amara, , fatmata] = form.tables[0].rows
        expect(
            recordsOf(fatmata).map((id) => form.readOnlyRecords.get(id))
        ).toEqual(recordsOf(fatmata).map(() => 'This enrolment is cancelled'))
        expect(
            recordsOf(amara).some((id) => form.readOnlyRecords.has(id))
        ).toBe(false)
    })

    test('no write access to the program or the person type says why, and adds no rows', async () => {
        const noProgram = await immunisationRegister().load(
            engineFor({
                program: {
                    ...immunisation,
                    access: { data: { write: false } },
                },
            }).engine
        )
        const [amara] = noProgram.tables[0].rows
        expect(
            new Set(
                recordsOf(amara).map((id) => noProgram.readOnlyRecords.get(id))
            )
        ).toEqual(
            new Set(['You do not have access to enter data in this program'])
        )
        expect(noProgram.newRows).toBeUndefined()

        const noType = await immunisationRegister().load(
            engineFor({
                program: {
                    ...immunisation,
                    trackedEntityType: {
                        id: PERSON_TYPE,
                        access: { data: { write: false } },
                    },
                },
            }).engine
        )
        expect(noType.readOnlyRecords.get('ImmTei00010')).toBe(
            'You do not have access to change people of this type'
        )
        expect(noType.readOnlyRecords.has('ImmEnr00010')).toBe(false)
        expect(noType.newRows).toBeUndefined()
    })
})

// The RMNCH program: its Unique ID is generated, and its first visit is scheduled on enrolment.
const RMNCH = 'WSGAb5XwJ3Y'
const UNIQUE_ID = 'lZGmxYbs97q'
const FIRST_VISIT = 'WZbXY0S00lP'
const SECOND_VISIT = 'edqlbukwRfQ'
const ANC_LAYOUT: RegisterLayout = {
    programId: RMNCH,
    columns: [
        { field: { attribute: UNIQUE_ID } },
        { field: { attribute: FIRST_NAME } },
        { field: { attribute: LAST_NAME } },
        { field: { attribute: BIRTH_DATE } },
        { field: { enrollment: ENROLLED_AT } },
        { field: { stage: FIRST_VISIT, eventDate: true } },
        { field: { stage: FIRST_VISIT, dataElement: 'OhcR0fpFcWa' } },
        { field: { stage: SECOND_VISIT, occurrence: 1, eventDate: true } },
        {
            field: {
                stage: SECOND_VISIT,
                occurrence: 1,
                dataElement: 'roKuXYfw1BW',
            },
        },
    ],
}
const ancRegister = () =>
    immunisationRegister({ programId: RMNCH, layout: ANC_LAYOUT })
const ancEngine = () =>
    engineFor({
        program: rmnch,
        enrollments: { enrollments: [] },
        reserved: [{ value: '8350217746' }, { value: '8350217747' }],
    })

describe('new rows', () => {
    test('a new row holds a person, an enrolment and one event per slot, with reserved values', async () => {
        const fake = ancEngine()
        const source = ancRegister()
        const form = await source.load(fake.engine)
        expect(form.newRows).toEqual({ tableId: RMNCH, orgUnitId: NGELEHUN })
        expect(fake.requests).toContainEqual({
            reserved: {
                resource: `trackedEntityAttributes/${UNIQUE_ID}/generateAndReserve`,
                params: { numberToReserve: 10 },
            },
        })
        const made = source.newRow?.(RMNCH)
        const slots = made?.row.slots ?? {}
        expect(made?.row).toEqual({
            id: slots.enrollment,
            label: 'New person',
            slots: {
                person: slots.person,
                enrollment: slots.enrollment,
                [FIRST_VISIT]: expect.any(String),
                [`${SECOND_VISIT}#1`]: expect.any(String),
            },
            labelFrom: [
                cellKey(slots.person, UNIQUE_ID),
                cellKey(slots.person, FIRST_NAME),
            ],
        })
        expect(made?.records.map((record) => [record.kind, record.id])).toEqual(
            [
                ['trackedEntity', slots.person],
                ['enrollment', slots.enrollment],
                ['event', slots[FIRST_VISIT]],
                ['event', slots[`${SECOND_VISIT}#1`]],
            ]
        )
        expect(made?.records[1]).toMatchObject({
            trackedEntityId: slots.person,
            orgUnitId: NGELEHUN,
            status: 'ACTIVE',
            isNew: true,
        })
        expect(made?.values).toEqual(
            new Map([[cellKey(slots.person, UNIQUE_ID), '8350217746']])
        )
        // Each new person takes the next reserved value.
        const second = source.newRow?.(RMNCH)
        expect([...(second?.values.values() ?? [])]).toEqual(['8350217747'])
    })

    /** A new row of `source`, typed in full and saved by `saving` (the same tab, or another); what was imported. */
    const savedRow = async (
        source = ancRegister(),
        saving = source,
        extra: (made: NewRow) => OutboxRecord[] = () => []
    ) => {
        const fake = ancEngine()
        await source.load(fake.engine)
        const form = await saving.load(fake.engine)
        const made = source.newRow?.(RMNCH)
        if (made === undefined) {
            throw new Error('No new row')
        }
        const [person, enrollment] = made.records
        await saving.save(
            fake.engine,
            [
                edit(person, UNIQUE_ID, '8350217746'),
                edit(person, FIRST_NAME, 'Isatu'),
                edit(person, LAST_NAME, 'Koroma'),
                edit(person, BIRTH_DATE, '1999-02-01'),
                edit(enrollment, ENROLLED_AT, '2026-10-20'),
                ...extra(made),
            ],
            form
        )
        const [imported] = fake.mutations
        return {
            made,
            events: imported.type === 'create' ? imported.data.events : [],
        }
    }

    test('a new person’s save brings the events Capture schedules, in their slots, waiting for the slot’s date', async () => {
        const { made, events } = await savedRow()
        // Its slot has a date column: it is scheduled, undated, until the clerk types the date the paper has.
        expect(events).toEqual([
            {
                event: made.row.slots?.[FIRST_VISIT],
                program: RMNCH,
                programStage: FIRST_VISIT,
                enrollment: made.row.id,
                orgUnit: NGELEHUN,
                status: 'SCHEDULE',
                scheduledAt: '2026-10-20',
            },
        ])
    })

    test('a scheduled event in a slot with no date column is dated as Capture dates it', async () => {
        const layout = {
            ...ANC_LAYOUT,
            columns: ANC_LAYOUT.columns.filter(
                (column) =>
                    !(
                        'field' in column &&
                        'stage' in column.field &&
                        column.field.stage === FIRST_VISIT &&
                        'eventDate' in column.field
                    )
            ),
        }
        const { events } = await savedRow(
            immunisationRegister({ programId: RMNCH, layout })
        )
        expect(events).toEqual([
            expect.objectContaining({
                programStage: FIRST_VISIT,
                status: 'SCHEDULE',
                scheduledAt: '2026-10-20',
                occurredAt: '2026-10-20',
            }),
        ])
    })

    test('a person made in another tab gets their scheduled event in the slot typed there, once', async () => {
        const { made, events } = await savedRow(
            ancRegister(),
            ancRegister(),
            (row) => [edit(row.records[2], EVENT_DATE_COLUMN, '2026-10-21')]
        )
        expect(events).toEqual([
            expect.objectContaining({
                event: made.row.slots?.[FIRST_VISIT],
                programStage: FIRST_VISIT,
                status: 'ACTIVE',
                occurredAt: '2026-10-21',
                scheduledAt: '2026-10-20',
            }),
        ])
    })

    test('a new row’s events in a stage the user may not enter data in are read-only, as an event grid’s are', async () => {
        const source = ancRegister()
        await source.load(
            engineFor({
                program: {
                    ...rmnch,
                    programStages: rmnch.programStages.map((stage) =>
                        stage.id === SECOND_VISIT
                            ? { ...stage, access: { data: { write: false } } }
                            : stage
                    ),
                },
                enrollments: { enrollments: [] },
            }).engine
        )
        const made = source.newRow?.(RMNCH)
        expect(made?.readOnlyRecords).toEqual(
            new Map([
                [
                    made?.row.slots?.[`${SECOND_VISIT}#1`],
                    'You do not have access to enter data in this stage',
                ],
            ])
        )
    })
})
