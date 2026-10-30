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
import { PartlySaved } from '../outbox/failure'
import { EVENT_DATE_COLUMN } from './eventSchemas'
import { eventSaver, outcomesFromReport } from './eventSave'
import { eventSource } from './eventSource'

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
    // The read and the import each have their own limit.
    expect(grid.signals[0]).not.toBe(grid.readSignals[0])
    expect(outcomes.map(({ result }) => result)).toEqual([
        'saved',
        'failed',
        'saved',
    ])
})

test('reads and imports at most 100 events at a time, one after another', async () => {
    const grid = await person()
    const ids = Array.from(
        { length: 250 },
        (_, at) => `Ev${String(at).padStart(9, '0')}`
    )
    const outcomes = await grid.save(
        ...ids.map((id) =>
            change(id, EVENT_DATE_COLUMN, '2026-10-26', NEW_VISIT)
        )
    )
    // Each request within its own limit, so a long backlog drains however slow each request is.
    expect(new Set([...grid.readSignals, ...grid.signals]).size).toBe(6)
    const chunks = [ids.slice(0, 100), ids.slice(100, 200), ids.slice(200)]
    expect(grid.reads.map(({ current }) => current.params)).toEqual(
        chunks.map((chunk) =>
            expect.objectContaining({
                program: RMNCH,
                events: chunk.join(','),
                pageSize: chunk.length,
            })
        )
    )
    expect(
        grid.mutations.map((mutation) =>
            mutation.type === 'delete'
                ? []
                : mutation.data.events.map(
                      ({ event }: { event: string }) => event
                  )
        )
    ).toEqual(chunks)
    expect(outcomes).toHaveLength(250)
    expect(outcomes.every(({ result }) => result === 'saved')).toBe(true)
})

/** 250 new second visits: three imports of 100, 100 and 50 events. */
const newVisits = () =>
    Array.from({ length: 250 }, (_, at) =>
        change(
            `Ev${String(at).padStart(9, '0')}`,
            EVENT_DATE_COLUMN,
            '2026-10-26',
            NEW_VISIT
        )
    )

/** Answers the first import with a report, and throws `failure` for the second. */
const secondImportThrows = (failure: Error) => {
    let imports = 0
    return async () => {
        imports += 1
        if (imports === 2) {
            throw failure
        }
        return importOneRefused
    }
}

test('a later import refused as a whole keeps what the earlier ones saved; the refusal is the rest’s', async () => {
    const refusal = fetchError('access', 'Forbidden', {
        httpStatusCode: 403,
        message: 'No access to the stage',
    })
    const grid = await person(rmnchEvents.events, secondImportThrows(refusal))
    const records = newVisits()
    // The third import is not sent, as the sync loop sends nothing more of a call it refuses.
    await expect(grid.save(...records)).rejects.toMatchObject({
        outcomes: records.slice(0, 100).map(saved),
        failure: refusal,
    })
    expect(grid.mutations).toHaveLength(2)
})

test('a later import that may pass on a retry keeps what the earlier ones saved', async () => {
    const failure = fetchError('unknown', 'Internal Server Error', {
        httpStatusCode: 500,
    })
    const grid = await person(rmnchEvents.events, secondImportThrows(failure))
    const records = newVisits()
    const thrown = await grid.save(...records).catch((error: Error) => error)
    expect(thrown).toBeInstanceOf(PartlySaved)
    expect(thrown).toMatchObject({
        outcomes: records.slice(0, 100).map(saved),
        failure,
    })
})

test('each request has its own limit: a backlog slower than one limit drains', async () => {
    const { form } = await person()
    // Each import takes 30 ms, and gives up when its signal aborts.
    const slowImports = fakeEngine(
        PERSON_LOAD,
        rmnchEvents.events,
        (options) =>
            new Promise((resolve, reject) => {
                const timer = setTimeout(() => resolve(importOneRefused), 30)
                options?.signal?.addEventListener('abort', () => {
                    clearTimeout(timer)
                    reject(options.signal?.reason)
                })
            })
    )
    const outcomes = await eventSaver(SOURCE, RMNCH, 50).save(
        slowImports.engine,
        newVisits(),
        form
    )
    expect(slowImports.mutations).toHaveLength(3)
    expect(outcomes.filter(({ result }) => result === 'saved')).toHaveLength(
        250
    )
})

test('a later request that runs out of time loses nothing the earlier ones saved', async () => {
    const { form } = await person()
    let imports = 0
    const hangsSecond = fakeEngine(
        PERSON_LOAD,
        rmnchEvents.events,
        (options) => {
            imports += 1
            return imports === 2
                ? new Promise((_resolve, reject) =>
                      options?.signal?.addEventListener('abort', () =>
                          reject(options.signal?.reason)
                      )
                  )
                : Promise.resolve(importOneRefused)
        }
    )
    const records = newVisits()
    await expect(
        eventSaver(SOURCE, RMNCH, 20).save(hangsSecond.engine, records, form)
    ).rejects.toMatchObject({ outcomes: records.slice(0, 100).map(saved) })
    expect(hangsSecond.signals.map((signal) => signal?.aborted)).toEqual([
        false,
        true,
    ])
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
    expect(await grid.restoreRows(records)).toEqual([
        { id: NEW, label: '2026-10-26', ...restored },
        { id: other, label: 'New event', ...restored },
    ])
})

test('a restored row of a grid of several stages names its stage', async () => {
    const grid = await person()
    expect(await grid.restoreRows(NEW_VISIT_RECORDS())).toMatchObject([
        { id: NEW, stage: 'Second antenatal care visit' },
    ])
})

test('restores no row for a new event saved since', async () => {
    const grid = await person()
    const records = NEW_VISIT_RECORDS()
    await grid.save(...records)
    expect(await grid.restoreRows(records)).toEqual([])
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
    expect((await grid.restoreRows(records)).map(({ id }) => id)).toEqual([NEW])
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
    ).toEqual([])
    expect(grid.reads).toEqual([])
})

test('new rows are restored when DHIS2 cannot be asked which it holds', async () => {
    const grid = await inpatient()
    const unreachable = fakeEngine(INPATIENT_LOAD, [], undefined, 10_000)
    const records = [change(NEW, AGE, '6', NEW_INPATIENT)]
    expect(
        (
            await eventSaver(SOURCE, INPATIENT, 20).restoreRows(
                unreachable.engine,
                records,
                grid.form
            )
        ).map(({ id }) => id)
    ).toEqual([NEW])
})
