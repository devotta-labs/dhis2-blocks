import i18n from '@dhis2/d2-i18n'
import { z } from 'zod'
import { cellKey } from '../model/types'
import type { CellKey, EventStatus, GridRow } from '../model/types'
import type { OutboxRecord } from '../outbox/outbox'
import type { SaveOutcome } from '../outbox/sync'
import {
    EVENT_DATE_COLUMN,
    EVENT_LEVEL_FIELDS,
    eventFieldsSchema,
} from './eventSchemas'
import type { DataEngine, LoadedForm } from './types'

type EventFields = z.infer<typeof eventFieldsSchema>

/**
 * One event of a tracker import. An update replaces the event's own fields with what is sent, so they are sent as
 * DHIS2 holds them, and merges `dataValues` into its values.
 */
type TrackerEventPayload = EventFields & {
    dataValues: Array<{ dataElement: string; value: string | null }>
}

/** A save, read included, that takes longer is aborted, so the sync loop backs off and tries again. */
const SAVE_TIMEOUT = 60_000

// OBJECT saves the valid events of an import and reports the refused ones by id.
const IMPORT_PARAMS = {
    async: false,
    importStrategy: 'CREATE_AND_UPDATE',
    atomicMode: 'OBJECT',
}

// Field names are shown as DHIS2 gives them, not HTML-escaped.
const AS_IS = { escapeValue: false }

const importReportSchema = z.object({
    status: z.string(),
    validationReport: z.object({
        errorReports: z.array(
            z.object({
                errorCode: z.string(),
                message: z.string(),
                uid: z.string().optional(),
            })
        ),
    }),
})

type ImportReport = z.infer<typeof importReportSchema>

// A refused import (HTTP 409) throws with its report as the error's details.
const refusalSchema = z.object({ details: importReportSchema })

const currentSchema = z.object({
    current: z.object({ events: z.array(eventFieldsSchema) }),
})

type Outcome = Pick<SaveOutcome, 'sourceKey' | 'key'>

const rowOf = (key: CellKey) => key.slice(0, key.indexOf('.'))
const columnOf = (key: CellKey) => key.slice(key.indexOf('.') + 1)

const dataValuesOf = (records: ReadonlyArray<OutboxRecord>) =>
    records
        .filter(({ key }) => columnOf(key) !== EVENT_DATE_COLUMN)
        .map(({ key, value }) => ({ dataElement: columnOf(key), value }))

/** The event date cell is date-only; a new date keeps the time of day DHIS2 holds. */
const withTime = (date: string, held: string | undefined) =>
    `${date}${held?.slice(10) ?? ''}`

/** Runs `task` with a signal that aborts after `timeout` ms. */
const withinLimit = async <T>(
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

// Ids per read, so the request stays well within URL limits however many events wait.
const READ_CHUNK = 100

/** What DHIS2 holds now for each event of `ids` in the program; an event it does not return is new or gone. */
const readEvents = async (
    engine: DataEngine,
    programId: string,
    ids: string[],
    signal: AbortSignal
) => {
    const current = new Map<string, EventFields>()
    for (let at = 0; at < ids.length; at += READ_CHUNK) {
        const chunk = ids.slice(at, at + READ_CHUNK)
        const { events } = currentSchema.parse(
            await engine.query(
                {
                    current: {
                        resource: 'tracker/events',
                        params: {
                            program: programId,
                            events: chunk.join(','),
                            fields: EVENT_LEVEL_FIELDS,
                            pageSize: chunk.length,
                        },
                    },
                },
                { signal }
            )
        ).current
        for (const event of events) {
            current.set(event.event, event)
        }
    }
    return current
}

/**
 * Records of an event the report names are refused with its messages: a new event's wait, so they are sent
 * again together once a cell is corrected; an existing event's fail. A report without an event id fails none.
 * When the import was refused as a whole (status ERROR) nothing was saved, so the other records get no outcome.
 */
export const outcomesFromReport = (
    records: ReadonlyArray<Outcome>,
    report: ImportReport,
    created: ReadonlySet<string>
): SaveOutcome[] => {
    const refusals = new Map<string, string[]>()
    for (const { uid, message } of report.validationReport.errorReports) {
        if (uid !== undefined) {
            refusals.set(uid, [...(refusals.get(uid) ?? []), message])
        }
    }
    return records.flatMap(({ sourceKey, key }): SaveOutcome[] => {
        const event = rowOf(key)
        const messages = refusals.get(event)
        if (messages !== undefined) {
            return [
                {
                    sourceKey,
                    key,
                    result: created.has(event) ? 'waiting' : 'failed',
                    reason: messages.join('; '),
                },
            ]
        }
        return report.status === 'ERROR'
            ? []
            : [{ sourceKey, key, result: 'saved' }]
    })
}

const importEvents = async (
    engine: DataEngine,
    events: TrackerEventPayload[],
    sent: ReadonlyArray<Outcome>,
    created: ReadonlySet<string>,
    signal: AbortSignal
) => {
    try {
        const response = await engine.mutate(
            {
                resource: 'tracker',
                type: 'create',
                params: IMPORT_PARAMS,
                data: { events },
            },
            { signal }
        )
        return outcomesFromReport(
            sent,
            importReportSchema.parse(response),
            created
        )
    } catch (error) {
        const refusal = refusalSchema.safeParse(error)
        const ids = new Set(events.map(({ event }) => event))
        // A refusal that names none of the sent events is about the request, so the sync loop refuses its records.
        const namesAnEvent =
            refusal.success &&
            refusal.data.details.validationReport.errorReports.some(
                ({ uid }) => uid !== undefined && ids.has(uid)
            )
        if (!refusal.success || !namesAnEvent) {
            throw error
        }
        return outcomesFromReport(sent, refusal.data.details, created)
    }
}

/**
 * Saving for one event source. Every import is built from the event fields DHIS2 holds at that moment, read in
 * the same request limit, because an update replaces whatever it is not sent and the loaded form may be stale.
 * Network, session and server failures are thrown to the sync loop.
 */
export const eventSaver = (
    sourceKey: string,
    programId: string,
    timeout = SAVE_TIMEOUT
) => {
    // Events DHIS2 held when loaded or saved here: never restored as new rows, failed once no longer returned.
    const held = new Set<string>()

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
        events: TrackerEventPayload[],
        sent: ReadonlyArray<Outcome>,
        created: ReadonlySet<string>,
        signal: AbortSignal
    ) => {
        const outcomes = await importEvents(
            engine,
            events,
            sent,
            created,
            signal
        )
        for (const { key, result } of outcomes) {
            if (result === 'saved') {
                held.add(rowOf(key))
            }
        }
        return outcomes
    }

    /**
     * One payload per event DHIS2 holds or the records make new. `waiting` holds the outcomes of records not sent:
     * a new event waits for its event date and, in an ON_UPDATE_AND_INSERT stage, its required fields; clearing an
     * event date or a required value is refused, and so is any change to an event DHIS2 held but no longer returns.
     * Records of other events get no outcome.
     */
    const payloads = (
        records: ReadonlyArray<OutboxRecord>,
        form: LoadedForm,
        current: ReadonlyMap<string, EventFields>
    ) => {
        const names = new Map(
            form.tables.flatMap(({ columns }) =>
                columns.map(({ id, label }) => [id, label])
            )
        )
        const nameOf = (column: string) =>
            column === EVENT_DATE_COLUMN
                ? i18n.t('Event date')
                : (names.get(column) ?? column)
        // An ON_UPDATE_AND_INSERT stage always requires its fields; an ON_COMPLETE stage once the event is completed.
        const requiredIn = (stage: string, status: EventStatus) =>
            form.strategy.get(stage) === 'ON_UPDATE_AND_INSERT' ||
            status === 'COMPLETED'
                ? (form.required.get(stage) ?? new Set<string>())
                : new Set<string>()

        const byEvent = new Map<string, OutboxRecord[]>()
        for (const record of records) {
            const event = rowOf(record.key)
            byEvent.set(event, [...(byEvent.get(event) ?? []), record])
        }

        const events: TrackerEventPayload[] = []
        const waiting: SaveOutcome[] = []
        for (const [event, changes] of byEvent) {
            const date =
                changes.find(({ key }) => columnOf(key) === EVENT_DATE_COLUMN)
                    ?.value ?? undefined
            const base = current.get(event)
            if (base !== undefined) {
                const required = requiredIn(base.programStage, base.status)
                const refused = changes.filter(
                    ({ key, value }) =>
                        value === null &&
                        (columnOf(key) === EVENT_DATE_COLUMN ||
                            required.has(columnOf(key)))
                )
                for (const { sourceKey: source, key } of refused) {
                    waiting.push({
                        sourceKey: source,
                        key,
                        result: 'failed',
                        reason: i18n.t('{{field}} is required', {
                            field: nameOf(columnOf(key)),
                            interpolation: AS_IS,
                        }),
                    })
                }
                const sent = changes.filter(
                    (change) => !refused.includes(change)
                )
                if (sent.length > 0) {
                    events.push({
                        ...base,
                        occurredAt:
                            date === undefined
                                ? base.occurredAt
                                : withTime(date, base.occurredAt),
                        dataValues: dataValuesOf(sent),
                    })
                }
                continue
            }

            // DHIS2 had it, so it was deleted or is out of the user's reach; its changes cannot be saved.
            if (held.has(event)) {
                for (const { sourceKey: source, key } of changes) {
                    waiting.push({
                        sourceKey: source,
                        key,
                        result: 'failed',
                        reason: i18n.t(
                            'This event was deleted or you no longer have access to it'
                        ),
                    })
                }
                continue
            }
            const newRow = changes.find((change) => change.row?.isNew)?.row
            if (newRow === undefined) {
                continue
            }
            const filled = new Set(
                changes
                    .filter(({ value }) => value !== null)
                    .map(({ key }) => columnOf(key))
            )
            const missing = [
                EVENT_DATE_COLUMN,
                ...requiredIn(newRow.programStageId, 'ACTIVE'),
            ].filter((column) => !filled.has(column))
            if (missing.length > 0) {
                const reason = i18n.t(
                    'Waiting for required fields: {{fields}}',
                    {
                        fields: missing.map(nameOf).join(', '),
                        interpolation: AS_IS,
                    }
                )
                for (const { sourceKey: source, key } of changes) {
                    waiting.push({
                        sourceKey: source,
                        key,
                        result: 'waiting',
                        reason,
                    })
                }
                continue
            }
            events.push({
                event,
                program: programId,
                programStage: newRow.programStageId,
                orgUnit: newRow.orgUnitId,
                enrollment: newRow.enrollmentId,
                occurredAt: date,
                status: 'ACTIVE',
                dataValues: dataValuesOf(changes),
            })
        }
        return { events, waiting }
    }

    return {
        /** Notes the events a load found, so they are not restored as new rows. */
        remember(eventIds: ReadonlyArray<string>) {
            for (const id of eventIds) {
                held.add(id)
            }
        },

        /** Sends the records' events in one tracker import. */
        save: (
            engine: DataEngine,
            records: ReadonlyArray<OutboxRecord>,
            form: LoadedForm
        ) =>
            inTurn(() =>
                withinLimit(timeout, async (signal): Promise<SaveOutcome[]> => {
                    const current = await readEvents(
                        engine,
                        programId,
                        [...new Set(records.map(({ key }) => rowOf(key)))],
                        signal
                    )
                    const { events, waiting } = payloads(records, form, current)
                    if (events.length === 0) {
                        return waiting
                    }
                    const inPayload = new Set(events.map(({ event }) => event))
                    const notSent = new Set(waiting.map(({ key }) => key))
                    const sent = records.filter(
                        ({ key }) =>
                            inPayload.has(rowOf(key)) && !notSent.has(key)
                    )
                    const created = new Set(
                        [...inPayload].filter((id) => !current.has(id))
                    )
                    return [
                        ...waiting,
                        ...(await send(engine, events, sent, created, signal)),
                    ]
                })
            ),

        /** Completes or reopens an event DHIS2 holds; its one outcome is keyed `<event>.status`. */
        setStatus: (
            engine: DataEngine,
            rowId: string,
            status: 'COMPLETED' | 'ACTIVE'
        ) =>
            inTurn(() =>
                withinLimit(timeout, async (signal): Promise<SaveOutcome[]> => {
                    const key = cellKey(rowId, 'status')
                    const event = (
                        await readEvents(engine, programId, [rowId], signal)
                    ).get(rowId)
                    if (event === undefined) {
                        return [
                            {
                                sourceKey,
                                key,
                                result: 'failed',
                                reason: held.has(rowId)
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
                        [{ ...event, status, dataValues: [] }],
                        [{ sourceKey, key }],
                        new Set(),
                        signal
                    )
                })
            ),

        /** One row per new event DHIS2 does not hold, in the order they were made, labelled by its event date. */
        restoreRows: (records: ReadonlyArray<OutboxRecord>) => {
            const rows = new Map<string, GridRow>()
            for (const { key, value, row } of [...records].sort(
                (a, b) => a.at - b.at
            )) {
                const id = rowOf(key)
                if (!row?.isNew || held.has(id)) {
                    continue
                }
                const restored = rows.get(id) ?? {
                    id,
                    label: i18n.t('New event'),
                    programStageId: row.programStageId,
                    orgUnitId: row.orgUnitId,
                    enrollmentId: row.enrollmentId,
                    status: 'ACTIVE',
                    isNew: true,
                }
                if (columnOf(key) === EVENT_DATE_COLUMN && value !== null) {
                    restored.label = value
                }
                rows.set(id, restored)
            }
            return [...rows.values()]
        },
    }
}
