import i18n from '@dhis2/d2-i18n'
import { z } from 'zod'
import { cellKey, recordIdOf } from '../model/types'
import type { DataRecord } from '../model/types'
import { PartlySaved } from '../outbox/failure'
import type { OutboxRecord } from '../outbox/outbox'
import type { SaveOutcome } from '../outbox/sync'
import {
    ENROLLMENT_LEVEL_FIELDS,
    EVENT_LEVEL_FIELDS,
    PERSON_LEVEL_FIELDS,
    enrollmentFieldsSchema,
    eventFieldsSchema,
    personFieldsSchema,
} from './eventSchemas'
import type { EventFields, PersonFields } from './eventSchemas'
import { belongsTo, buildImport } from './trackerPayload'
import type {
    HeldRecords,
    ScheduledEvents,
    SentObjects,
    TrackerPayload,
} from './trackerPayload'
import { importReportSchema, outcomesFromReport } from './trackerReport'
import type { Outcome } from './trackerReport'
import type { DataEngine, DataEntrySource, LoadedForm } from './types'

/** A request of a save (a read or an import) that takes longer is aborted, so the sync loop backs off and tries again. */
export const SAVE_TIMEOUT = 60_000

// OBJECT saves the valid objects of an import and reports the refused ones by id.
const IMPORT_PARAMS = {
    async: false,
    importStrategy: 'CREATE_AND_UPDATE',
    atomicMode: 'OBJECT',
}

// A refused import (HTTP 409) throws with its report as the error's details.
const refusalSchema = z.object({ details: importReportSchema })

/** Runs `task` with a signal that aborts after `timeout` ms. */
export const withinLimit = async <T>(
    timeout: number,
    task: (signal: AbortSignal) => Promise<T>
) => {
    // Not `AbortSignal.timeout`, which older Safari lacks.
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)
    try {
        return await task(controller.signal)
    } finally {
        clearTimeout(timer)
    }
}

// Records per read and per import, so each request stays well within URL and server limits however many wait.
const CHUNK = 100

/** What DHIS2 holds now of each id, read 100 at a time; one it does not return is new or gone. */
const readHeld = async <T>(
    engine: DataEngine,
    ids: ReadonlyArray<string>,
    signal: AbortSignal,
    read: (chunk: string[]) => {
        resource: string
        params: Record<string, string | number>
    },
    parse: (answer: Awaited<ReturnType<DataEngine['query']>>) => T[],
    idOf: (held: T) => string
) => {
    const held = new Map<string, T>()
    for (let at = 0; at < ids.length; at += CHUNK) {
        const chunk = ids.slice(at, at + CHUNK)
        const answer = await engine.query({ current: read(chunk) }, { signal })
        for (const item of parse(answer)) {
            held.set(idOf(item), item)
        }
    }
    return held
}

const heldEventsSchema = z.object({
    current: z.object({ events: z.array(eventFieldsSchema) }),
})
const heldEnrollmentsSchema = z.object({
    current: z.object({ enrollments: z.array(enrollmentFieldsSchema) }),
})
const heldPeopleSchema = z.object({
    current: z.object({ trackedEntities: z.array(personFieldsSchema) }),
})

/** What DHIS2 holds now for each event of `ids` in the program; an event it does not return is new or gone. */
export const readEvents = (
    engine: DataEngine,
    programId: string,
    ids: ReadonlyArray<string>,
    signal: AbortSignal
): Promise<Map<string, EventFields>> =>
    readHeld(
        engine,
        ids,
        signal,
        (chunk) => ({
            resource: 'tracker/events',
            params: {
                program: programId,
                events: chunk.join(','),
                fields: EVENT_LEVEL_FIELDS,
                pageSize: chunk.length,
            },
        }),
        (answer) => heldEventsSchema.parse(answer).current.events,
        ({ event }) => event
    )

/**
 * The people, enrolments and events of the records and of what their new records belong to, read before an import.
 * People are read by their type, not the program: one whose enrolment DHIS2 refused is saved but not enrolled.
 */
const readRecords = async (
    engine: DataEngine,
    programId: string,
    ids: ReadonlyArray<string>,
    recordOf: (id: string) => DataRecord | undefined,
    signal: AbortSignal
): Promise<HeldRecords> => {
    const events: string[] = []
    const enrollments = new Set<string>()
    const peopleByType = new Map<string, Set<string>>()
    const addPerson = (id: string) => {
        const record = recordOf(id)
        if (record?.kind === 'trackedEntity') {
            const type = record.trackedEntityTypeId
            peopleByType.set(
                type,
                (peopleByType.get(type) ?? new Set()).add(id)
            )
        }
    }
    for (const id of ids) {
        const record = recordOf(id)
        switch (record?.kind) {
            case 'trackedEntity':
                addPerson(id)
                break
            case 'enrollment':
                enrollments.add(id)
                if (record.isNew) {
                    addPerson(record.trackedEntityId)
                }
                break
            default:
                events.push(id)
                // An event's enrolment, when the form knows it: whether it is saved, and its date for a slot with none.
                if (
                    record?.kind === 'event' &&
                    record.enrollmentId !== undefined &&
                    recordOf(record.enrollmentId)?.kind === 'enrollment'
                ) {
                    enrollments.add(record.enrollmentId)
                }
        }
    }
    const people = new Map<string, PersonFields>()
    for (const [type, ofType] of peopleByType) {
        const held = await readHeld(
            engine,
            [...ofType],
            signal,
            (chunk) => ({
                resource: 'tracker/trackedEntities',
                params: {
                    trackedEntityType: type,
                    trackedEntities: chunk.join(','),
                    fields: PERSON_LEVEL_FIELDS,
                    pageSize: chunk.length,
                },
            }),
            (answer) => heldPeopleSchema.parse(answer).current.trackedEntities,
            ({ trackedEntity }) => trackedEntity
        )
        held.forEach((person, id) => people.set(id, person))
    }
    return {
        people,
        enrollments: await readHeld(
            engine,
            [...enrollments],
            signal,
            (chunk) => ({
                resource: 'tracker/enrollments',
                params: {
                    program: programId,
                    enrollments: chunk.join(','),
                    fields: ENROLLMENT_LEVEL_FIELDS,
                    pageSize: chunk.length,
                },
            }),
            (answer) => heldEnrollmentsSchema.parse(answer).current.enrollments,
            ({ enrollment }) => enrollment
        ),
        events: await readEvents(engine, programId, events, signal),
    }
}

/** The lists of the payload that hold anything: an event grid's import is `{ events }`. */
const dataOf = (payload: TrackerPayload) =>
    Object.fromEntries(
        Object.entries(payload).filter(([, list]) => list.length > 0)
    )

const importRecords = async (
    engine: DataEngine,
    payload: TrackerPayload,
    sent: ReadonlyArray<Outcome>,
    created: ReadonlySet<string>,
    objects: SentObjects,
    signal: AbortSignal
) => {
    try {
        const response = await engine.mutate(
            {
                resource: 'tracker',
                type: 'create',
                params: IMPORT_PARAMS,
                data: dataOf(payload),
            },
            { signal }
        )
        return outcomesFromReport(
            sent,
            importReportSchema.parse(response),
            created,
            objects
        )
    } catch (error) {
        const refusal = refusalSchema.safeParse(error)
        // A refusal that names none of the sent objects is about the request, so the sync loop refuses its records.
        const namesAnObject =
            refusal.success &&
            refusal.data.details.validationReport.errorReports.some(
                ({ uid }) => uid !== undefined && objects.has(uid)
            )
        if (!refusal.success || !namesAnObject) {
            throw error
        }
        return outcomesFromReport(sent, refusal.data.details, created, objects)
    }
}

/**
 * The records in groups of at most 100 records, in their order, each person, enrolment and event whose records are
 * saved together kept in one group: an import never splits a new person from its enrolment.
 */
const groupsOf = (
    records: ReadonlyArray<OutboxRecord>,
    recordOf: (id: string) => DataRecord | undefined
) => {
    const ids = [...new Set(records.map(({ key }) => recordIdOf(key)))]
    const saving = new Set(ids)
    const parentOf = (id: string) => {
        const parent = belongsTo(recordOf(id))
        return parent !== undefined && saving.has(parent) ? parent : undefined
    }
    const families = new Map<string, string[]>()
    for (const id of ids) {
        let root = id
        for (let up = parentOf(root); up !== undefined; up = parentOf(root)) {
            root = up
        }
        families.set(root, [...(families.get(root) ?? []), id])
    }
    const groups: string[][] = []
    for (const family of families.values()) {
        const last = groups.at(-1)
        if (last !== undefined && last.length + family.length <= CHUNK) {
            last.push(...family)
        } else {
            groups.push([...family])
        }
    }
    return groups.map((group) => {
        const inGroup = new Set(group)
        return records.filter(({ key }) => inGroup.has(recordIdOf(key)))
    })
}

/**
 * Saving for one program's people, enrolments and events. Every import is built from what DHIS2 holds of them at
 * that moment, read just before it, because an update replaces whatever it is not sent and the loaded form may be
 * stale. Network, session and server failures are thrown to the sync loop, with the outcomes of the imports saved
 * before them. `scheduledEvents` names the events a new enrolment brings, sent in its import.
 */
export const trackerSaver = (
    sourceKey: string,
    programId: string,
    options: { timeout?: number; scheduledEvents?: ScheduledEvents } = {}
) => {
    const timeout = options.timeout ?? SAVE_TIMEOUT
    // Records DHIS2 held when loaded or saved here: never restored as new rows, failed once no longer returned.
    const remembered = new Set<string>()
    const known: ReadonlySet<string> = remembered

    // One import at a time, each read after the one before was saved, so a save never undoes a status change.
    let last = Promise.resolve()
    const inTurn = <T>(task: () => Promise<T>) => {
        const turn = last.then(task)
        last = turn.then(
            () => undefined,
            () => undefined
        )
        return turn
    }

    const send = async (
        engine: DataEngine,
        payload: TrackerPayload,
        sent: ReadonlyArray<Outcome>,
        created: ReadonlySet<string>,
        objects: SentObjects,
        signal: AbortSignal
    ) => {
        const outcomes = await importRecords(
            engine,
            payload,
            sent,
            created,
            objects,
            signal
        )
        for (const { key, result } of outcomes) {
            if (result === 'saved') {
                remembered.add(recordIdOf(key))
            }
        }
        return outcomes
    }

    /** One group's records: what DHIS2 holds of them is read, then they are imported. */
    const saveGroup = async (
        engine: DataEngine,
        records: ReadonlyArray<OutboxRecord>,
        form: LoadedForm,
        recordOf: (id: string) => DataRecord | undefined
    ): Promise<SaveOutcome[]> => {
        const held = await withinLimit(timeout, (signal) =>
            readRecords(
                engine,
                programId,
                [...new Set(records.map(({ key }) => recordIdOf(key)))],
                recordOf,
                signal
            )
        )
        const { payload, sent, waiting, objects } = buildImport(
            records,
            form,
            held,
            {
                programId,
                remembered,
                scheduledEvents: options.scheduledEvents,
            }
        )
        if (objects.size === 0) {
            return waiting
        }
        const isHeld = (id: string) =>
            held.events.has(id) ||
            held.enrollments.has(id) ||
            held.people.has(id)
        const created = new Set([...objects.keys()].filter((id) => !isHeld(id)))
        return [
            ...waiting,
            ...(await withinLimit(timeout, (signal) =>
                send(engine, payload, sent, created, objects, signal)
            )),
        ]
    }

    return {
        /** Notes the records a load found, so they are not restored as new rows. */
        remember(ids: ReadonlyArray<string>) {
            for (const id of ids) {
                remembered.add(id)
            }
        },

        /** The records DHIS2 held when loaded or saved here. */
        remembered: known,

        /**
         * Sends the records 100 at a time, one group after another: each read, then imported, each request within
         * its own limit. A failure keeps the outcomes of the groups before it (`PartlySaved`).
         */
        save: ((engine, records, form) =>
            inTurn(async () => {
                // As a change made it new, else as a change or the form holds it.
                const changed = new Map<string, DataRecord>()
                for (const { key, record } of records) {
                    const id = recordIdOf(key)
                    if (record && (record.isNew || !changed.has(id))) {
                        changed.set(id, record)
                    }
                }
                const recordOf = (id: string) =>
                    changed.get(id) ?? form.records.get(id)
                const outcomes: SaveOutcome[] = []
                for (const group of groupsOf(records, recordOf)) {
                    try {
                        outcomes.push(
                            ...(await saveGroup(engine, group, form, recordOf))
                        )
                    } catch (error) {
                        throw outcomes.length === 0
                            ? error
                            : new PartlySaved(
                                  outcomes,
                                  error instanceof Error
                                      ? error
                                      : new Error(String(error))
                              )
                    }
                }
                return outcomes
            })) satisfies DataEntrySource['save'],

        /** Completes or reopens an event DHIS2 holds; its one outcome is keyed `<event>.status`. */
        setStatus: ((engine, recordId, status) =>
            inTurn(() =>
                withinLimit(timeout, async (signal): Promise<SaveOutcome[]> => {
                    const key = cellKey(recordId, 'status')
                    const event = (
                        await readEvents(engine, programId, [recordId], signal)
                    ).get(recordId)
                    if (event === undefined) {
                        return [
                            {
                                sourceKey,
                                key,
                                result: 'failed',
                                reason: remembered.has(recordId)
                                    ? i18n.t(
                                          'This event was deleted or you no longer have access to it'
                                      )
                                    : i18n.t(
                                          'This event has not been saved yet'
                                      ),
                            },
                        ]
                    }
                    return send(
                        engine,
                        {
                            trackedEntities: [],
                            enrollments: [],
                            events: [{ ...event, status, dataValues: [] }],
                        },
                        [{ sourceKey, key }],
                        new Set(),
                        new Map([[recordId, { kind: 'event' }]]),
                        signal
                    )
                })
            )) satisfies DataEntrySource['setStatus'],
    }
}
