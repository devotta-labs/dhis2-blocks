import importAllRefused from './__tests__/fixtures/import-all-refused.json'
import importOneRefused from './__tests__/fixtures/import-one-refused.json'
import inpatientEvents from './__tests__/fixtures/inpatient-events.json'
import rmnchEvents from './__tests__/fixtures/rmnch-person-events.json'
import {
    A,
    AGE,
    B,
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
    PERSON_LOAD,
    REFUSED_AGE,
    RMNCH,
    SOURCE,
    VISIT,
    change,
    fakeEngine,
    fetchError,
    inpatient,
    inpatientSource,
    openGrid,
    person,
    saved,
} from './__tests__/saveRig'
import { EVENT_DATE_COLUMN } from './eventSchemas'
import { eventSaver, outcomesFromReport } from './eventSave'

const NEW_VISIT_RECORDS = () => [
    change(NEW, EVENT_DATE_COLUMN, '2026-10-26', NEW_VISIT),
    change(NEW, GESTATIONAL_AGE, '20', NEW_VISIT),
]

const failed = (key: string, reason: string) => ({
    sourceKey: SOURCE,
    key,
    result: 'failed',
    reason,
})

test('reads what DHIS2 holds for the batch in one request, then sends one import', async () => {
    const grid = await inpatient()
    const outcomes = await grid.save(
        change(A, AGE, '6'),
        change(B, AGE, 'abc'),
        change(A, HEIGHT, null)
    )
    expect(grid.reads).toEqual([
        {
            current: {
                resource: 'tracker/events',
                params: {
                    program: INPATIENT,
                    events: `${A},${B}`,
                    fields: 'event,program,programStage,orgUnit,enrollment,occurredAt,scheduledAt,status,attributeOptionCombo,geometry,assignedUser',
                    pageSize: 2,
                },
            },
        },
    ])
    expect(grid.mutations).toEqual([
        {
            resource: 'tracker',
            type: 'create',
            params: {
                async: false,
                importStrategy: 'CREATE_AND_UPDATE',
                atomicMode: 'OBJECT',
            },
            data: { events: grid.sent() },
        },
    ])
    expect(grid.sent().map(({ event }) => event)).toEqual([A, B])
    // One limit covers the read and the import.
    expect(grid.signals[0]).toBe(grid.readSignals[0])
    expect(outcomes.map(({ result }) => result)).toEqual([
        'saved',
        'failed',
        'saved',
    ])
})

test('reads at most 100 events at a time', async () => {
    const grid = await person()
    const ids = Array.from(
        { length: 250 },
        (_, at) => `Ev${String(at).padStart(9, '0')}`
    )
    await grid.save(
        ...ids.map((id) =>
            change(id, EVENT_DATE_COLUMN, '2026-10-26', NEW_VISIT)
        )
    )
    // All under the save's one signal, so one limit covers them.
    expect(new Set(grid.readSignals).size).toBe(1)
    expect(grid.reads.map(({ current }) => current.params)).toEqual(
        [ids.slice(0, 100), ids.slice(100, 200), ids.slice(200)].map((chunk) =>
            expect.objectContaining({
                program: RMNCH,
                events: chunk.join(','),
                pageSize: chunk.length,
            })
        )
    )
    expect(grid.mutations).toHaveLength(1)
    expect(grid.sent()).toHaveLength(250)
})

test('changes to an event DHIS2 no longer returns fail with the reason', async () => {
    // Loaded, then deleted by someone else or moved out of the user's reach.
    const grid = await openGrid(
        inpatientSource(),
        INPATIENT_LOAD,
        inpatientEvents.events.filter(({ event }) => event !== A)
    )
    const gone = 'This event was deleted or you no longer have access to it'
    const record = change(A, AGE, '6')
    expect(await grid.save(record)).toEqual([failed(record.key, gone)])
    expect(await grid.setStatus(A, 'COMPLETED')).toEqual([
        {
            sourceKey: expect.stringMatching(/^events:/),
            key: `${A}.status`,
            result: 'failed',
            reason: gone,
        },
    ])
    expect(grid.mutations).toEqual([])
})

test('marks only the refused event', () => {
    const records = [
        change(A, AGE, '6'),
        change(A, HEIGHT, null),
        change(B, AGE, 'abc'),
    ]
    expect(outcomesFromReport(records, importOneRefused, new Set())).toEqual([
        saved(records[0]),
        saved(records[1]),
        failed(records[2].key, REFUSED_AGE),
    ])
})

test('a refused new event waits with the reason, so its cells go again together', async () => {
    const refusing = {
        ...importOneRefused,
        validationReport: {
            errorReports: [NEW, VISIT].map((uid) => ({
                errorCode: 'E1302',
                message: REFUSED_AGE,
                uid,
            })),
        },
    }
    const grid = await person(rmnchEvents.events, async () => refusing)
    const outcomes = await grid.save(
        change(NEW, EVENT_DATE_COLUMN, '2026-10-26', NEW_VISIT),
        change(NEW, GESTATIONAL_AGE, 'abc', NEW_VISIT),
        change(VISIT, GESTATIONAL_AGE, 'abc')
    )
    expect(outcomes.map(({ result, reason }) => [result, reason])).toEqual([
        ['waiting', REFUSED_AGE],
        ['waiting', REFUSED_AGE],
        ['failed', REFUSED_AGE],
    ])
})

test('a report without an event id fails no event', async () => {
    const grid = await inpatient(async () => ({
        status: 'OK',
        validationReport: {
            errorReports: [{ errorCode: 'E9999', message: 'Server problem' }],
        },
    }))
    const record = change(A, AGE, '6')
    expect(await grid.save(record)).toEqual([saved(record)])
})

test('a refused import saved nothing, so only the events it names fail', async () => {
    const grid = await inpatient(async () => {
        throw fetchError('access', 'Conflict', importAllRefused)
    })
    const records = [change(A, AGE, '6'), change(B, AGE, 'abc')]
    expect(await grid.save(...records)).toEqual([
        failed(records[1].key, REFUSED_AGE),
    ])
})

test('a refusal that names none of the sent events reaches the sync loop', async () => {
    const refusal = fetchError('access', 'Conflict', importAllRefused)
    const grid = await inpatient(async () => {
        throw refusal
    })
    await expect(grid.save(change(A, AGE, '6'))).rejects.toBe(refusal)
})

test('other failures reach the sync loop', async () => {
    const failures = [
        fetchError('access', 'Conflict', {
            httpStatusCode: 409,
            message: 'Conflict',
        }),
        fetchError('unknown', 'Internal Server Error', {
            httpStatusCode: 500,
        }),
        new TypeError('Failed to fetch'),
    ]
    for (const failure of failures) {
        const grid = await inpatient(async () => {
            throw failure
        })
        await expect(grid.save(change(A, AGE, '6'))).rejects.toBe(failure)
    }
})

test('gives up on a save, read included, that takes longer than its limit', async () => {
    const { form } = await person()
    const hangingImport = fakeEngine(
        PERSON_LOAD,
        rmnchEvents.events,
        (options) =>
            new Promise((_resolve, reject) =>
                options?.signal?.addEventListener('abort', () =>
                    reject(options.signal?.reason)
                )
            )
    )
    await expect(
        eventSaver(SOURCE, RMNCH, 20).save(
            hangingImport.engine,
            NEW_VISIT_RECORDS(),
            form
        )
    ).rejects.toThrow()
    expect(hangingImport.signals[0]?.aborted).toBe(true)

    const slowRead = fakeEngine(
        PERSON_LOAD,
        rmnchEvents.events,
        undefined,
        10_000
    )
    await expect(
        eventSaver(SOURCE, RMNCH, 20).save(
            slowRead.engine,
            NEW_VISIT_RECORDS(),
            form
        )
    ).rejects.toThrow()
    expect(slowRead.mutations).toEqual([])

    // A save that finishes in time stops its clock.
    const quick = fakeEngine(PERSON_LOAD, rmnchEvents.events)
    await eventSaver(SOURCE, RMNCH, 20).save(
        quick.engine,
        NEW_VISIT_RECORDS(),
        form
    )
    await new Promise((resolve) => setTimeout(resolve, 40))
    expect(quick.signals[0]?.aborted).toBe(false)
})

test('a status change sends the event as DHIS2 holds it, with its new status and no values', async () => {
    const grid = await inpatient()
    const status = (rowId: string) => ({
        sourceKey: expect.stringMatching(/^events:/),
        key: `${rowId}.status`,
    })
    expect(await grid.setStatus(A, 'ACTIVE')).toEqual([
        { ...status(A), result: 'saved' },
    ])
    expect(grid.reads[0]).toMatchObject({
        current: { params: { events: A, pageSize: 1 } },
    })
    expect(grid.sent()).toEqual([
        { ...EVENT_A, status: 'ACTIVE', dataValues: [] },
    ])
    expect(await grid.setStatus(B, 'ACTIVE')).toEqual([
        { ...status(B), result: 'failed', reason: REFUSED_AGE },
    ])
    expect(await grid.setStatus(NEW, 'COMPLETED')).toEqual([
        {
            ...status(NEW),
            result: 'failed',
            reason: 'This event has not been saved yet',
        },
    ])
    expect(grid.mutations).toHaveLength(2)
})

test('a save waits for a status change in flight', async () => {
    const gate = Promise.withResolvers<void>()
    const grid = await inpatient(async () => {
        await gate.promise
        return importOneRefused
    })
    const reopening = grid.setStatus(A, 'ACTIVE')
    const saving = grid.save(change(A, AGE, '6'))
    await new Promise((resolve) => setTimeout(resolve, 10))
    // The save reads only after the status change is saved.
    expect([grid.reads.length, grid.mutations.length]).toEqual([1, 1])
    gate.resolve()
    await Promise.all([reopening, saving])
    expect([grid.reads.length, grid.mutations.length]).toEqual([2, 2])
})

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
        programStageId: INPATIENT_STAGE,
        orgUnitId: NGELEHUN,
        status: 'ACTIVE',
        isNew: true,
    }
    // A was loaded, so a new-row change to it restores no row.
    expect(grid.restoreRows(records)).toEqual([
        { id: NEW, label: '2026-10-26', ...restored },
        { id: other, label: 'New event', ...restored },
    ])
})

test('restores no row for a new event saved since', async () => {
    const grid = await person()
    const records = NEW_VISIT_RECORDS()
    await grid.save(...records)
    expect(grid.restoreRows(records)).toEqual([])
})
