import inpatientEvents from './__tests__/fixtures/inpatient-events.json'
import {
    A,
    AGE,
    EVENT_A,
    GESTATIONAL_AGE,
    HEIGHT,
    INPATIENT,
    INPATIENT_LOAD,
    INPATIENT_STAGE,
    NEW,
    NEW_INPATIENT,
    NEW_VISIT,
    NGELEHUN,
    change,
    fakeEngine,
    inpatient,
    inpatientSource,
    openGrid,
    person,
} from './__tests__/saveRig'
import { restoreEventRows } from './eventRestore'
import { EVENT_DATE_COLUMN } from './eventSchemas'
import { eventSource } from './eventSource'

const NEW_VISIT_RECORDS = () => [
    change(NEW, EVENT_DATE_COLUMN, '2026-10-26', NEW_VISIT),
    change(NEW, GESTATIONAL_AGE, '20', NEW_VISIT),
]

test('restores new rows from the outbox', async () => {
    const grid = await inpatient()
    const other = 'Rb2cD3eF4gH'
    const records = [
        change(NEW, AGE, '6', NEW_INPATIENT),
        change(A, AGE, '7'),
        change(A, HEIGHT, '8', NEW_INPATIENT),
        change(other, AGE, '8', NEW_INPATIENT),
        change(NEW, EVENT_DATE_COLUMN, '2026-10-26', NEW_INPATIENT),
    ]
    const restored = {
        kind: 'event',
        programStageId: INPATIENT_STAGE,
        orgUnitId: NGELEHUN,
        status: 'ACTIVE',
        isNew: true,
    }
    // A was loaded, so a new-row change to it restores no row.
    expect(await grid.restoreRows(records)).toEqual({
        rows: [
            { id: NEW, label: '2026-10-26' },
            { id: other, label: 'New event' },
        ],
        records: [
            { id: NEW, ...restored },
            { id: other, ...restored },
        ],
    })
})

test('a restored row of a grid of several stages names its stage', async () => {
    const grid = await person()
    expect((await grid.restoreRows(NEW_VISIT_RECORDS())).rows).toMatchObject([
        { id: NEW, stage: 'Second antenatal care visit' },
    ])
})

test('restores no row for a new event saved since', async () => {
    const grid = await person()
    const records = NEW_VISIT_RECORDS()
    await grid.save(...records)
    expect(await grid.restoreRows(records)).toEqual({ rows: [], records: [] })
})

test('restores only the new rows this form adds, and none DHIS2 already holds', async () => {
    // Saved from another grid, or beyond the page this one loaded.
    const savedElsewhere = 'Sv3dE4fG5hI'
    const grid = await openGrid(inpatientSource(), INPATIENT_LOAD, [
        ...inpatientEvents.events,
        { ...EVENT_A, event: savedElsewhere },
    ])
    const records = [
        change(NEW, AGE, '6', NEW_INPATIENT),
        change(savedElsewhere, AGE, '7', NEW_INPATIENT),
        change('Ou2cD3eF4gH', AGE, '8', {
            ...NEW_INPATIENT,
            orgUnitId: 'ImspTQPwCqd',
        }),
        change('St2cD3eF4gH', AGE, '9', {
            ...NEW_INPATIENT,
            programStageId: 'A03MvHHogjR',
        }),
        change('En2cD3eF4gH', AGE, '5', {
            ...NEW_INPATIENT,
            enrollmentId: 'RiLEKhWHlxZ',
        }),
    ]
    expect((await grid.restoreRows(records)).rows.map(({ id }) => id)).toEqual([
        NEW,
    ])
    expect(grid.reads.at(-1)).toMatchObject({
        current: {
            params: { events: [NEW, savedElsewhere].join(',') },
        },
    })
})

test('a form that adds no rows restores none, and reads nothing', async () => {
    const grid = await openGrid(
        eventSource({
            programId: INPATIENT,
            orgUnitId: NGELEHUN,
            orgUnitMode: 'DESCENDANTS',
        }),
        INPATIENT_LOAD,
        inpatientEvents.events
    )
    expect(
        await grid.restoreRows([change(NEW, AGE, '6', NEW_INPATIENT)])
    ).toEqual({ rows: [], records: [] })
    expect(grid.reads).toEqual([])
})

test('new rows are restored when DHIS2 cannot be asked which it holds', async () => {
    const grid = await inpatient()
    const unreachable = fakeEngine(INPATIENT_LOAD, [], undefined, 10_000)
    const records = [change(NEW, AGE, '6', NEW_INPATIENT)]
    expect(
        (
            await restoreEventRows(unreachable.engine, records, grid.form, {
                programId: INPATIENT,
                remembered: new Set(),
                timeout: 20,
            })
        ).rows.map(({ id }) => id)
    ).toEqual([NEW])
})
