import { expect, test } from 'vitest'
import { cellKey, recordIdOf, recordsOf } from '../model/types'
import type { EventRecord, GridRow, PersonRecord } from '../model/types'
import type { OutboxRecord } from '../outbox/outbox'
import { EVENT_DATE_COLUMN } from '../sources/eventSchemas'
import {
    BCG,
    BIRTH_DATE,
    DOSE,
    DPT_1,
    DPT_2,
    ENROLLED_AT,
    FIRST_NAME,
    LAST_NAME,
    NGELEHUN,
    OPV_1,
    PROGRAM,
    VACCINATION,
    VACCINE,
    edit,
    engineFor,
    enrolledAs,
} from './__tests__/registerRig'
import {
    ENROLMENT,
    OPV,
    PERSON,
    restoredDose,
    restoring,
} from './__tests__/restoreRig'

/** The new person comes back as one row, with the ids their changes name, holding every typed cell. */
const expectTheirRow = (rows: GridRow[], outbox: OutboxRecord[]) => {
    expect(rows).toHaveLength(1)
    const [row] = rows
    expect(row).toMatchObject({
        id: ENROLMENT.id,
        slots: {
            person: PERSON.id,
            enrollment: ENROLMENT.id,
            [OPV_1]: OPV.id,
        },
    })
    expect(
        outbox.every(({ key }) => recordsOf(row).includes(recordIdOf(key)))
    ).toBe(true)
}

test('after a reload a half-typed new person comes back once with the same ids', async () => {
    const outbox = [
        edit(PERSON, FIRST_NAME, 'Isatu'),
        edit(PERSON, LAST_NAME, 'Koroma'),
        edit(ENROLMENT, ENROLLED_AT, '2026-10-20'),
        edit(OPV, EVENT_DATE_COLUMN, '2026-10-21'),
    ]
    const { rows, records } = await restoring(outbox)
    expectTheirRow(rows, outbox)
    expect(rows[0]).toEqual({
        id: ENROLMENT.id,
        label: 'Isatu Koroma',
        slots: {
            person: PERSON.id,
            enrollment: ENROLMENT.id,
            [BCG]: expect.any(String),
            [OPV_1]: OPV.id,
            [DPT_1]: expect.any(String),
            [DPT_2]: expect.any(String),
        },
        labelFrom: [
            cellKey(PERSON.id, FIRST_NAME),
            cellKey(PERSON.id, LAST_NAME),
        ],
    })
    expect(records.slice(0, 2)).toEqual([PERSON, ENROLMENT])
    expect(records).toContainEqual(OPV)
    expect(records).toHaveLength(6)
})

test('a slot event typed alone comes back on its new person’s row, with their ids', async () => {
    const outbox = [edit(OPV, EVENT_DATE_COLUMN, '2026-10-21')]
    const { rows, records } = await restoring(outbox)
    expectTheirRow(rows, outbox)
    expect(rows[0].label).toBe('New person')
    expect(records.slice(0, 2)).toEqual([
        { ...PERSON },
        { ...ENROLMENT, trackedEntityId: PERSON.id },
    ])
})

test('a person and a slot event typed, but no enrolment date, come back as one row', async () => {
    const outbox = [
        edit(PERSON, FIRST_NAME, 'Isatu'),
        edit(OPV, EVENT_DATE_COLUMN, '2026-10-21'),
    ]
    const { rows } = await restoring(outbox)
    expectTheirRow(rows, outbox)
    expect(rows[0].label).toBe('Isatu')
})

test('a restored slot event waits for its new enrolment, never sent with one DHIS2 does not hold', async () => {
    const outbox = [
        edit(PERSON, FIRST_NAME, 'Isatu'),
        edit(OPV, EVENT_DATE_COLUMN, '2026-10-21'),
    ]
    const { source, form } = await restoring(outbox)
    const fake = engineFor()
    const outcomes = await source.save(fake.engine, outbox, form)
    expect(outcomes).toContainEqual({
        sourceKey: `register:${PROGRAM}`,
        key: cellKey(OPV.id, EVENT_DATE_COLUMN),
        result: 'waiting',
        reason: 'Waiting for the enrolment to be saved',
    })
    expect(fake.mutations).toEqual([])
})

test('an unsent slot event of a loaded person replaces the id minted for its slot', async () => {
    const dpt: EventRecord = {
        kind: 'event',
        id: 'EvtTyped002',
        programStageId: VACCINATION,
        orgUnitId: NGELEHUN,
        enrollmentId: 'ImmEnr00010',
        status: 'ACTIVE',
        isNew: true,
        slot: DPT_1,
    }
    const { source, form, rows, records } = await restoring([
        edit(dpt, EVENT_DATE_COLUMN, '2026-10-30'),
    ])
    const [amara] = form.tables[0].rows
    expect(rows).toEqual([
        { ...amara, slots: { ...amara.slots, [DPT_1]: dpt.id } },
    ])
    expect(records).toEqual([dpt])
    // A later load keeps the restored id for that slot.
    const again = await source.load(engineFor().engine)
    expect(again.tables[0].rows[0].slots?.[DPT_1]).toBe(dpt.id)
    expect(again.records.get(dpt.id)).toEqual(dpt)
})

/** A loaded person's restored dose the row cannot take: it is refused with `reason` when saved, never sent. */
const expectRefused = async (
    dose: EventRecord,
    reason: string,
    answers: Parameters<typeof engineFor>[0] = {}
) => {
    const outbox = [edit(dose, EVENT_DATE_COLUMN, '2026-10-30')]
    const { source, form, rows } = await restoring(outbox, answers)
    expect(rows).toEqual([])
    const fake = engineFor()
    expect(await source.save(fake.engine, outbox, form)).toEqual([
        {
            sourceKey: `register:${PROGRAM}`,
            key: cellKey(dose.id, EVENT_DATE_COLUMN),
            result: 'failed',
            reason,
        },
    ])
    expect(fake.mutations).toEqual([])
}

test('a restored event for a cancelled enrolment’s row is refused with the row’s reason', async () => {
    await expectRefused(
        restoredDose('ImmEnr00030', DPT_1),
        'This enrolment is cancelled',
        {
            enrollments: enrolledAs((enrollment, at) =>
                at === 2 ? { ...enrollment, status: 'CANCELLED' } : enrollment
            ),
        }
    )
})

test('a restored event for a slot DHIS2 filled since is refused, not sent as a second event', async () => {
    // Amara's BCG slot holds ImmEvt00001.
    await expectRefused(
        restoredDose('ImmEnr00010', BCG),
        'Another event fills this slot now; this change was not saved'
    )
})

// A person DHIS2 holds whose enrolment is not on the pages loaded.
const LATER_PERSON = 'ImmTei00099'
const LATER_ENROLMENT = 'ImmEnr00099'
const heldLater = (events: object[] = []) => ({
    trackedEntities: [
        {
            trackedEntity: LATER_PERSON,
            enrollments: [
                {
                    enrollment: LATER_ENROLMENT,
                    program: PROGRAM,
                    status: 'ACTIVE',
                    events,
                },
            ],
        },
    ],
    enrollments: [
        {
            enrollment: LATER_ENROLMENT,
            program: PROGRAM,
            status: 'ACTIVE',
            events,
        },
    ],
})

test('a dose typed for a person DHIS2 saved since goes on their loaded row, with DHIS2’s doses', async () => {
    const amara: PersonRecord = { ...PERSON, id: 'ImmTei00010' }
    const dpt: EventRecord = {
        ...OPV,
        id: 'EvtTyped004',
        enrollmentId: 'ImmEnr00010',
        trackedEntityId: amara.id,
        slot: DPT_1,
        createdWith: { [VACCINE]: 'DPT', [DOSE]: '1' },
    }
    const { form, rows, records } = await restoring([
        edit(amara, FIRST_NAME, 'Aminata'),
        edit(dpt, EVENT_DATE_COLUMN, '2026-10-30'),
    ])
    const [loaded] = form.tables[0].rows
    expect(rows).toEqual([
        { ...loaded, slots: { ...loaded.slots, [DPT_1]: dpt.id } },
    ])
    expect(rows[0].slots?.[BCG]).toBe('ImmEvt00001')
    expect(records).toEqual([dpt])
})

test('a name edited for a person a loaded row shows does not come back as a new person', async () => {
    const amara: PersonRecord = { ...PERSON, id: 'ImmTei00010' }
    const { rows } = await restoring([edit(amara, FIRST_NAME, 'Aminata')])
    expect(rows).toEqual([])
})

test('a dose typed for a held person beyond the loaded pages is not a new person, and goes into their enrolment', async () => {
    const person: PersonRecord = { ...PERSON, id: LATER_PERSON }
    const dose: EventRecord = {
        ...OPV,
        id: 'EvtTyped005',
        enrollmentId: LATER_ENROLMENT,
        trackedEntityId: LATER_PERSON,
    }
    const outbox = [
        edit(person, FIRST_NAME, 'Mariama'),
        edit(dose, EVENT_DATE_COLUMN, '2026-10-30'),
    ]
    const { source, form, rows } = await restoring(outbox, {
        held: heldLater(),
    })
    expect(rows).toEqual([])
    const fake = engineFor()
    await source.save(fake.engine, outbox, form)
    expect(fake.mutations).toHaveLength(1)
    // No second enrolment is made: the dose names the one DHIS2 holds.
    for (const mutation of fake.mutations) {
        const data = mutation.type === 'create' ? mutation.data : {}
        expect(data).not.toHaveProperty('enrollments')
        expect(data).toMatchObject({
            events: [{ event: dose.id, enrollment: LATER_ENROLMENT }],
        })
    }
})

test('an unsent dose whose slot DHIS2 filled since, on a page not loaded yet, is refused before sending', async () => {
    const filled = {
        held: heldLater([
            {
                event: 'ImmEvt00099',
                programStage: VACCINATION,
                occurredAt: '2026-10-28T00:00:00.000',
                dataValues: [
                    { dataElement: VACCINE, value: 'BCG' },
                    { dataElement: DOSE, value: '0' },
                ],
            },
        ]),
    }
    const dose = restoredDose(LATER_ENROLMENT, BCG)
    const taken = 'Another event fills this slot now; this change was not saved'
    await expectRefused(dose, taken, filled)
    // The same when the dose names the person it was typed for.
    await expectRefused(
        { ...dose, trackedEntityId: LATER_PERSON },
        taken,
        filled
    )
})

/** A reload that cannot ask DHIS2: the half-typed child, their dose, and a loaded person's dose beyond page 1. */
const UNCHECKED = [
    edit(PERSON, FIRST_NAME, 'Isatu'),
    edit(OPV, EVENT_DATE_COLUMN, '2026-10-21'),
    edit(restoredDose(LATER_ENROLMENT, DPT_1), EVENT_DATE_COLUMN, '2026-10-30'),
]

/** As the platform's `FetchError` is shaped with no network. */
const offline = () =>
    Object.assign(new Error('Failed to fetch'), { type: 'network' })

/** The child shows as one read-only row with `reason`, and nothing is sent: every change waits with `reason`. */
const expectUnchecked = async (failure: Error, reason: string) => {
    const { source, form, rows, records, readOnlyRecords } = await restoring(
        UNCHECKED,
        { held: failure }
    )
    expectTheirRow(rows, UNCHECKED.slice(0, 2))
    expect(rows[0].label).toBe('Isatu')
    expect(readOnlyRecords).toEqual(
        new Map(records.map(({ id }) => [id, reason]))
    )
    const fake = engineFor()
    expect(await source.save(fake.engine, UNCHECKED, form)).toEqual(
        UNCHECKED.map(({ key }) => ({
            sourceKey: `register:${PROGRAM}`,
            key,
            result: 'waiting',
            reason,
        }))
    )
    expect(fake.mutations).toEqual([])
    return source
}

test('offline, a half-typed child shows read-only with why, and nothing is sent or guessed', async () => {
    await expectUnchecked(
        offline(),
        'Not checked with DHIS2 yet. Reload the page when you are online.'
    )
})

test('when DHIS2 fails the check, the child shows read-only with DHIS2’s reason', async () => {
    await expectUnchecked(
        // As the platform's `FetchError` is shaped for a 500.
        Object.assign(new Error('Internal Server Error'), {
            type: 'unknown',
            details: { httpStatusCode: 500 },
        }),
        'Could not check these changes with DHIS2: Internal Server Error'
    )
})

test('a later restore that reaches DHIS2 makes the child editable, and their changes are sent', async () => {
    const source = await expectUnchecked(
        offline(),
        'Not checked with DHIS2 yet. Reload the page when you are online.'
    )
    const outbox = [
        edit(PERSON, FIRST_NAME, 'Isatu'),
        edit(PERSON, LAST_NAME, 'Koroma'),
        edit(PERSON, BIRTH_DATE, '2026-10-01'),
        edit(ENROLMENT, ENROLLED_AT, '2026-10-20'),
        edit(OPV, EVENT_DATE_COLUMN, '2026-10-21'),
    ]
    const form = await source.load(engineFor().engine)
    const { rows, readOnlyRecords } = await source.restoreRows(
        engineFor().engine,
        outbox,
        form
    )
    expectTheirRow(rows, outbox)
    expect(readOnlyRecords).toEqual(new Map())
    const fake = engineFor()
    await source.save(fake.engine, outbox, form)
    expect(fake.mutations).toHaveLength(1)
})
