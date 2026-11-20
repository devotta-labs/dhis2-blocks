import i18n from '@dhis2/d2-i18n'
import { parseDhis2Calendar } from '@/components/dhis2-value-display'
import { todayIso } from '@/components/dhis2-value-types'
import { cellKey } from '@/components/spreadsheet'
import type { CellKey, DataEngine } from '@/components/spreadsheet'
import { recordIdOf } from '../model/types'
import type { DataRecord, EventRecord, TrackerRow } from '../model/types'
import type { OutboxRecord } from '../outbox/outbox'
import type { SaveOutcome } from '../outbox/sync'
import { noWriteReason } from '../sources/eventEdit'
import { loadNamesOf } from '../sources/eventSource'
import { hasRulesIn } from '../sources/hasRules'
import type { ScheduledEvents } from '../sources/trackerPayload'
import { trackerSaver, withinLimit } from '../sources/trackerSave'
import type { TrackerDataEntrySource, LoadedForm } from '../sources/types'
import { generateUid } from '../sources/uid'
import { PERSON, compileLayout } from './compileLayout'
import type { CompiledLayout } from './compileLayout'
import type { RegisterLayout } from './layout'
import { registerMetadataOf, registerProgramSchema } from './metadata'
import type { RegisterMetadata } from './metadata'
import { nameOf, newPerson, reservedValues } from './newPerson'
import {
    ENROLLED_AT,
    READ_ONLY,
    programEditSchema,
    registerAnswerSchema,
    registerQuery,
    toForm,
} from './registerLoad'
import {
    RESTORE_TIMEOUT,
    heldSlotRefusal,
    readHeld,
    slotTaken,
    uncheckedReason,
    unsentRecords,
} from './restore'
import type { HeldEnrollment, UnsentPerson } from './restore'
import { scheduledEventsFor } from './scheduled'

const AS_IS = { escapeValue: false }

export interface RegisterSourceOptions {
    programId: string
    orgUnitId: string
    /** The period's first and last enrolment days (`YYYY-MM-DD`), both included. */
    enrolledFrom: string
    enrolledTo: string
    layout: RegisterLayout
    /** People a page; default 25. */
    pageSize?: number
    /** The date (`YYYY-MM-DD`) the expiry rules are checked against; the device's date by default. */
    today?: string
}

/**
 * A paper register as grid rows, one person per row: the program's enrolments at the org unit in the period, oldest
 * first, each row's cells saving to the person, the enrolment and the events the layout's slots pick. New rows are new
 * people, with the events Capture schedules on enrolment.
 */
export const registerSource: (
    options: RegisterSourceOptions
) => TrackerDataEntrySource = (options) => {
    const { programId, orgUnitId, enrolledFrom, enrolledTo, layout } = options
    const key = `register:${programId}`
    const pageSize = options.pageSize ?? 25
    let loaded:
        | {
              metadata: RegisterMetadata
              compiled: CompiledLayout
              calendar?: string
              engine: DataEngine
              rowReason?: string
              noWrite: ReadonlySet<string>
          }
        | undefined
    let systemInfo: { calendar?: string } | undefined
    let reserved: ReturnType<typeof reservedValues> | undefined
    const madeHere = new Map<string, Readonly<Record<string, string>>>()
    const restored = new Map<string, Map<string, EventRecord>>()
    const madeRecords = new Map<string, DataRecord>()
    const refused = new Map<string, string>()
    const unchecked = new Map<string, string>()

    const keep = (
        enrollmentId: string,
        slot: string,
        event: EventRecord,
        reason?: string
    ) => {
        const its = restored.get(enrollmentId) ?? new Map<string, EventRecord>()
        restored.set(enrollmentId, its.set(slot, event))
        if (reason !== undefined) {
            refused.set(event.id, reason)
        }
    }

    const placeRestored = (
        rows: ReadonlyArray<TrackerRow>,
        records: ReadonlyMap<string, DataRecord>,
        readOnly: ReadonlyMap<string, string>
    ) => {
        const placed: TrackerRow[] = []
        const events: EventRecord[] = []
        for (const row of rows) {
            const taken = [...(restored.get(row.id) ?? [])].filter(
                ([slot, event]) => {
                    const shown = row.slots?.[slot]
                    if (shown === event.id || saver.remembered.has(event.id)) {
                        refused.delete(event.id)
                        unchecked.delete(event.id)
                        return false
                    }
                    const reason =
                        readOnly.get(row.id) ??
                        (records.get(shown ?? '')?.isNew
                            ? undefined
                            : slotTaken())
                    unchecked.delete(event.id)
                    if (reason === undefined) {
                        refused.delete(event.id)
                    } else {
                        refused.set(event.id, reason)
                    }
                    return reason === undefined
                }
            )
            if (taken.length > 0) {
                placed.push({
                    ...row,
                    slots: {
                        ...row.slots,
                        ...Object.fromEntries(
                            taken.map(([slot, { id }]) => [slot, id])
                        ),
                    },
                })
                events.push(...taken.map(([, event]) => event))
            }
        }
        return { rows: placed, events }
    }

    const newRowReasons = (records: ReadonlyArray<DataRecord>) =>
        new Map(
            records.flatMap((record) =>
                record.kind === 'event' &&
                loaded?.noWrite.has(record.programStageId)
                    ? [[record.id, noWriteReason()]]
                    : []
            )
        )

    const scheduledEvents: ScheduledEvents = (
        enrollment,
        { enrolledAt, occurredAt },
        slotEvents
    ) => {
        if (loaded === undefined) {
            return []
        }
        const { metadata, compiled, calendar } = loaded
        let due: ReturnType<typeof scheduledEventsFor>
        try {
            due = scheduledEventsFor(
                metadata,
                {
                    enrolledAt: enrolledAt.slice(0, 10),
                    occurredAt: occurredAt?.slice(0, 10),
                },
                parseDhis2Calendar(calendar)
            )
        } catch {
            return []
        }
        const slots = {
            ...madeHere.get(enrollment.id),
            ...Object.fromEntries(slotEvents),
        }
        return due.map(({ stageId, scheduledAt, occurredAt }) => {
            const slot = compiled.slots.find(
                (each) =>
                    each.stageId === stageId &&
                    (each.kind === 'single' ||
                        (each.kind === 'occurrence' && each.occurrence === 1))
            )
            return {
                event: (slot && slots[slot.name]) ?? generateUid(),
                program: programId,
                programStage: stageId,
                orgUnit: enrollment.orgUnitId,
                enrollment: enrollment.id,
                status: 'SCHEDULE',
                scheduledAt,
                ...(occurredAt !== undefined &&
                    !slot?.hasDateColumn && { occurredAt }),
            }
        })
    }
    const saver = trackerSaver(key, programId, { scheduledEvents })

    const loadRegister: (
        engine: DataEngine,
        page: number | undefined,
        signal?: AbortSignal
    ) => Promise<LoadedForm> = async (engine, page, signal) => {
        const loading = engine.query(
            registerQuery(
                options,
                pageSize,
                page,
                page === undefined || systemInfo === undefined
            ),
            { signal }
        )
        let hasRules = false
        if (page === undefined) {
            void hasRulesIn(engine, programId, signal).then((has) => {
                hasRules = has
            })
        }
        const answer = await loading
        const parsed = registerAnswerSchema.parse({ systemInfo, ...answer })
        systemInfo = parsed.systemInfo
        const program = programEditSchema.parse(answer.program)
        const metadata = registerMetadataOf(
            registerProgramSchema.parse(answer.program)
        )
        const compiled = compileLayout(layout, metadata)
        if (!compiled.ok) {
            throw new Error(compiled.errors.join('; '))
        }
        const page1 = toForm(parsed, program, metadata, compiled.compiled, {
            layout,
            today: options.today ?? todayIso(),
            hasRules,
        })
        saver.remember([
            ...[...page1.records.values()]
                .filter(({ isNew }) => !isNew)
                .map(({ id }) => id),
            ...parsed.enrollments.enrollments.flatMap(({ events }) =>
                events.map(({ event }) => event)
            ),
        ])
        const back = placeRestored(
            page1.tables.flatMap((table) => table.rows),
            page1.records,
            page1.readOnlyRecords
        )
        const replaced = new Map(back.rows.map((row) => [row.id, row]))
        const form = {
            ...page1,
            tables: page1.tables.map((table) => ({
                ...table,
                rows: table.rows.map((row) => replaced.get(row.id) ?? row),
            })),
            records: new Map([
                ...page1.records,
                ...back.events.map((event) => [event.id, event] as const),
            ]),
        }
        loaded = {
            metadata,
            compiled: compiled.compiled,
            calendar: parsed.systemInfo.calendar,
            engine,
            rowReason: program.access.data.write
                ? undefined
                : READ_ONLY.program(),
            noWrite: new Set(
                program.programStages
                    .filter(({ access }) => !access.data.write)
                    .map(({ id }) => id)
            ),
        }
        const mayAdd =
            program.access.data.write &&
            program.trackedEntityType.access.data.write &&
            program.categoryCombo.isDefault
        reserved ??= reservedValues(
            [...metadata.attributes]
                .filter(([, { generated }]) => generated)
                .map(([id]) => id)
        )
        const [[orgUnitNames, fileNames]] = await Promise.all([
            loadNamesOf(engine, form, signal),
            page === undefined && mayAdd
                ? reserved.fill(engine, signal)
                : undefined,
        ])
        return {
            ...form,
            orgUnitNames,
            fileNames,
            hasMore: parsed.enrollments.enrollments.length === pageSize,
            newRows: mayAdd ? { tableId: programId, orgUnitId } : undefined,
        }
    }

    const inPeriod = (date: string | undefined) =>
        date === undefined || (date >= enrolledFrom && date <= enrolledTo)

    return {
        key,
        cacheKey: [
            key,
            orgUnitId,
            enrolledFrom,
            enrolledTo,
            pageSize,
            options.today ?? '-',
            JSON.stringify(layout),
        ].join(':'),
        load: (engine, signal) => loadRegister(engine, undefined, signal),
        loadPage: loadRegister,
        async save(engine, records, form) {
            const refusals: SaveOutcome[] = []
            const sent: OutboxRecord[] = []
            for (const record of records) {
                const id = recordIdOf(record.key)
                const reason = refused.get(id)
                const { sourceKey, key: cell } = record
                if (reason !== undefined) {
                    refusals.push({
                        sourceKey,
                        key: cell,
                        result: 'failed',
                        reason,
                    })
                } else if (unchecked.has(id)) {
                    refusals.push({
                        sourceKey,
                        key: cell,
                        result: 'waiting',
                        reason: unchecked.get(id),
                    })
                } else {
                    sent.push(record)
                }
            }
            return [
                ...refusals,
                ...(await saver.save(engine, sent, {
                    ...form,
                    records: new Map([...madeRecords, ...form.records]),
                })),
            ]
        },
        setStatus: saver.setStatus,
        newRow(tableId) {
            if (loaded === undefined || tableId !== programId) {
                throw new Error(`The register makes no rows for ${tableId}`)
            }
            const made = newPerson(loaded.compiled, loaded.metadata, orgUnitId)
            const [person] = made.records
            madeHere.set(made.row.id, made.row.slots ?? {})
            for (const record of made.records) {
                madeRecords.set(record.id, record)
            }
            const values = new Map<CellKey, string>()
            for (const [attribute, value] of reserved?.take(loaded.engine) ??
                []) {
                values.set(cellKey(person.id, attribute), value)
            }
            const { columns } = loaded.compiled
            const text = [...loaded.metadata.attributes]
                .filter(
                    ([id, { generated, mandatory }]) =>
                        generated &&
                        mandatory &&
                        !columns.some(
                            (c) => c.slot === PERSON && c.fieldId === id
                        ) &&
                        !values.has(cellKey(person.id, id))
                )
                .map(([, { name }]) =>
                    i18n.t('No value could be reserved for {{attribute}}', {
                        attribute: name,
                        interpolation: AS_IS,
                    })
                )
            return {
                ...made,
                messages: new Map(
                    text.length === 0
                        ? []
                        : [
                              [
                                  person.id,
                                  text.map((message) => ({
                                      tone: 'error' as const,
                                      text: message,
                                      source: 'server' as const,
                                      onComplete: true as const,
                                  })),
                              ],
                          ]
                ),
                values,
                readOnlyRecords: newRowReasons(made.records),
            }
        },
        async restoreRows(engine, outbox, form) {
            if (loaded === undefined) {
                return { rows: [], records: [] }
            }
            refused.clear()
            unchecked.clear()
            restored.clear()
            const { compiled, metadata, rowReason } = loaded
            const { people, loadedPeopleEvents, typed } = unsentRecords(
                outbox,
                {
                    programId,
                    remembered: saver.remembered,
                    slotNames: new Set(compiled.slots.map(({ name }) => name)),
                }
            )
            const shownRows = form.tables.flatMap((table) => table.rows)
            const shownOf = ({ enrollmentId }: UnsentPerson) =>
                form.records.has(enrollmentId ?? '') ? enrollmentId : undefined
            const personIds = people
                .filter((person) => shownOf(person) === undefined)
                .map(({ personId }) => personId)
            const enrollmentIds = [
                ...new Set(loadedPeopleEvents.map((e) => e.enrollmentId)),
            ].filter((id) => !form.records.has(id))
            const { held, failure } =
                personIds.length + enrollmentIds.length === 0
                    ? { held: { people: new Map(), enrollments: new Map() } }
                    : await withinLimit(RESTORE_TIMEOUT, (signal) =>
                          readHeld(
                              engine,
                              {
                                  programId,
                                  trackedEntityTypeId:
                                      metadata.trackedEntityTypeId,
                                  personIds,
                                  enrollmentIds,
                              },
                              signal
                          )
                      ).then(
                          (answer) => ({ held: answer, failure: undefined }),
                          (error: Error) => ({
                              held: undefined,
                              failure: uncheckedReason(error),
                          })
                      )
            const refusal = (off: HeldEnrollment, event: EventRecord) =>
                heldSlotRefusal(
                    off,
                    event,
                    compiled.slots,
                    rowReason ??
                        (off.status === 'CANCELLED'
                            ? READ_ONLY.cancelled()
                            : undefined)
                )

            for (const { enrollmentId, slot, event } of loadedPeopleEvents) {
                if (form.records.has(enrollmentId)) {
                    keep(enrollmentId, slot, event)
                } else if (held === undefined) {
                    keep(enrollmentId, slot, event)
                    unchecked.set(event.id, failure ?? '')
                } else {
                    const off = held.enrollments.get(enrollmentId)
                    keep(enrollmentId, slot, event, off && refusal(off, event))
                }
            }
            const rows: TrackerRow[] = []
            const records: DataRecord[] = []
            const readOnlyRecords = new Map<string, string>()
            for (const given of people) {
                const { personId, enrollmentId, person, enrollment, events } =
                    given
                const shown = shownOf(given)
                const off = held?.people.get(personId)
                if (shown !== undefined) {
                    events.forEach((event, slot) => keep(shown, slot, event))
                    continue
                }
                if (
                    off &&
                    (enrollmentId === undefined ||
                        off.enrollment === enrollmentId)
                ) {
                    events.forEach((event, slot) =>
                        keep(off.enrollment, slot, event, refusal(off, event))
                    )
                    continue
                }
                const enrolledAt =
                    enrollmentId === undefined
                        ? undefined
                        : typed.get(cellKey(enrollmentId, ENROLLED_AT))
                const first = enrollment ?? person ?? [...events.values()][0]
                const here =
                    first?.orgUnitId === orgUnitId && inPeriod(enrolledAt)
                if (failure !== undefined) {
                    for (const record of [
                        person,
                        enrollment,
                        ...events.values(),
                    ]) {
                        if (record !== undefined) {
                            unchecked.set(record.id, failure)
                        }
                    }
                }
                if (!here) {
                    continue
                }
                const made = newPerson(compiled, metadata, orgUnitId, given)
                madeHere.set(made.row.id, made.row.slots ?? {})
                rows.push({
                    ...made.row,
                    label:
                        nameOf(made.row, (cell) => typed.get(cell)) ||
                        i18n.t('New person'),
                })
                records.push(...made.records)
                for (const [id, reason] of newRowReasons(made.records)) {
                    readOnlyRecords.set(id, reason)
                }
                if (failure !== undefined) {
                    for (const { id } of made.records) {
                        readOnlyRecords.set(id, failure)
                    }
                }
            }
            const back = placeRestored(
                shownRows,
                form.records,
                form.readOnlyRecords
            )
            rows.unshift(...back.rows)
            records.unshift(...back.events)
            for (const record of records) {
                madeRecords.set(record.id, record)
            }
            return { rows, records, readOnlyRecords }
        },
    }
}
