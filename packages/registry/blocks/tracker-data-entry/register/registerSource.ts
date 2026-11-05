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
import { compileLayout } from './compileLayout'
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
export const registerSource = (
    options: RegisterSourceOptions
): TrackerDataEntrySource => {
    const { programId, orgUnitId, enrolledFrom, enrolledTo, layout } = options
    // Unsent changes belong to the program, so any of its registers sends them.
    const key = `register:${programId}`
    const pageSize = options.pageSize ?? 25
    // What the last load found, for new rows, restored rows and scheduled events.
    let loaded:
        | {
              metadata: RegisterMetadata
              compiled: CompiledLayout
              calendar?: string
              engine: DataEngine
              /** Why every row is read-only, when the user may not enter data in the program. */
              rowReason?: string
              /** The stages the user may not enter data in. */
              noWrite: ReadonlySet<string>
          }
        | undefined
    // The server's calendar as this source last loaded it: a page builds its expiry in it without asking again.
    let systemInfo: { calendar?: string } | undefined
    let reserved: ReturnType<typeof reservedValues> | undefined
    // The slots of the people made here, by enrolment id: the events Capture schedules for them fill those slots.
    const madeHere = new Map<string, Readonly<Record<string, string>>>()
    // Unsent slot events of people a page loads, by enrolment id and slot: any page that loads their person shows them.
    const restored = new Map<string, Map<string, EventRecord>>()
    // The records of the rows made here (new people, and those restored after a reload), which the loaded form does
    // not hold: a save needs them to know that a new event's enrolment is new too.
    const madeRecords = new Map<string, DataRecord>()
    // Changes refused before they are sent, by record id, with why: restored events their row can no longer take.
    const refused = new Map<string, string>()
    // Records whose changes wait unsent, with why: a reload could not ask DHIS2 whether they are new or which slot is
    // free.
    const unchecked = new Map<string, string>()

    /** Keeps a loaded person's unsent slot event for the page that loads them, or refuses it now with `reason`. */
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

    /**
     * Loaded rows with the unsent slot events restored for them, and those events. An event whose slot DHIS2 filled
     * since, or whose row is read-only, is refused instead: sent, it would be a second event in the slot, or one the
     * user may not make.
     */
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
                    // Saved since: DHIS2 holds it, in whichever slot it ranks it now, and its changes are ordinary ones.
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
                    // The loaded page is DHIS2's answer for it.
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

    /** Why a new row's records cannot be edited: its events in stages the user may not enter data in. */
    const newRowReasons = (records: ReadonlyArray<DataRecord>) =>
        new Map(
            records.flatMap((record): Array<[string, string]> =>
                record.kind === 'event' &&
                loaded?.noWrite.has(record.programStageId)
                    ? [[record.id, noWriteReason()]]
                    : []
            )
        )

    const scheduledEvents: ScheduledEvents = (
        enrollment,
        enrolledAt,
        slotEvents
    ) => {
        if (loaded === undefined) {
            return []
        }
        const { metadata, compiled, calendar } = loaded
        let due: ReturnType<typeof scheduledEventsFor>
        try {
            // shortcut: dated from the enrolment date; Capture uses a typed incident date, which this callback is not given.
            due = scheduledEventsFor(
                metadata,
                { enrolledAt: enrolledAt.slice(0, 10) },
                parseDhis2Calendar(calendar)
            )
        } catch {
            // @dhis2/multi-calendar-dates cannot add days on a Coptic calendar (reported upstream): none are scheduled.
            return []
        }
        // The import's own slot events first: the row may have been made in another tab, or by an earlier load.
        const slots = {
            ...madeHere.get(enrollment.id),
            ...Object.fromEntries(slotEvents),
        }
        return due.map(({ stageId, scheduledAt, occurredAt }) => {
            // The stage's own slot, or its first visit's; a stage the layout does not show gets an event of its own.
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
                // A slot with a date column waits for the clerk's date, so the screen shows what DHIS2 holds.
                ...(occurredAt !== undefined &&
                    !slot?.hasDateColumn && { occurredAt }),
            }
        })
    }
    const saver = trackerSaver(key, programId, { scheduledEvents })

    /** One page of the register, page 1 unless named, with the names of what its values hold. */
    const loadRegister = async (
        engine: DataEngine,
        page: number | undefined,
        signal?: AbortSignal
    ): Promise<LoadedForm> => {
        const loading = engine.query(
            registerQuery(
                options,
                pageSize,
                page,
                page === undefined || systemInfo === undefined
            ),
            { signal }
        )
        // Asked beside the form's query, on the first load only; the form never waits for the answer.
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
        // What DHIS2 holds of the page, events the layout leaves out included: none is restored as new.
        saver.remember([
            ...[...page1.records.values()]
                .filter(({ isNew }) => !isNew)
                .map(({ id }) => id),
            ...parsed.enrollments.enrollments.flatMap(({ events }) =>
                events.map(({ event }) => event)
            ),
        ])
        // Unsent slot events restored for the people this page loads take their slots.
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
        // A new person needs write access to the program and to its type.
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
            // No total is asked for: counting costs DHIS2 a query on large databases.
            hasMore: parsed.enrollments.enrollments.length === pageSize,
            newRows: mayAdd ? { tableId: programId, orgUnitId } : undefined,
        }
    }

    const inPeriod = (date: string | undefined) =>
        date === undefined || (date >= enrolledFrom && date <= enrolledTo)

    return {
        key,
        // Everything that changes the load; the outbox keeps the program's one key, so no change is stranded.
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
            return {
                ...made,
                values,
                readOnlyRecords: newRowReasons(made.records),
            }
        },
        /**
         * Rows for the unsent changes after a reload. DHIS2 is asked which of the people and enrolments they name it
         * holds: a held one's slot events go to its loaded row (now, or when its page loads), refused at once when
         * the enrolment is read-only or DHIS2 fills their slot since; only people DHIS2 does not hold come back as new
         * rows, with the ids their changes name. If DHIS2 cannot be asked, what it would decide waits unsent.
         */
        async restoreRows(engine, outbox, form) {
            if (loaded === undefined) {
                return { rows: [], records: [] }
            }
            // Decided afresh from the outbox and DHIS2: nothing an earlier restore decided stands.
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
            // A loaded person's own records are remembered, never unsent new ones: only their events name them here.
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
            /** Why a held enrolment off the loaded pages cannot take a slot event, if it cannot. */
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
                    // Kept for its page, whose load is DHIS2's answer; until then it waits, unsent.
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
                // DHIS2 holds them, enrolled: a loaded person whose page is not loaded yet.
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
                // Another register's person: another org unit, or enrolled in another period.
                const first = enrollment ?? person ?? [...events.values()][0]
                const here =
                    first?.orgUnitId === orgUnitId && inPeriod(enrolledAt)
                // Not asked: shown read-only, with the ids its changes name, so nobody types them again.
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
