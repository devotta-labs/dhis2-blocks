import i18n from '@dhis2/d2-i18n'
import { z } from 'zod'
import type { CellKey } from '@/components/spreadsheet'
import { fieldIdOfKey, recordIdOf } from '../model/types'
import type { DataRecord, EnrollmentRecord, EventStatus } from '../model/types'
import type { OutboxRecord } from '../outbox/outbox'
import type { SaveOutcome } from '../outbox/sync'
import { EVENT_DATE_COLUMN } from './eventSchemas'
import type {
    EnrollmentFields,
    EventFields,
    PersonFields,
} from './eventSchemas'
import {
    eventWait,
    goneReason,
    waitingFor,
    waitingForParent,
} from './trackerReasons'
import type { LoadedForm } from './types'

/** What DHIS2 holds now of the records about to be saved, by id; a record it does not return is new or gone. */
export interface HeldRecords {
    events: ReadonlyMap<string, EventFields>
    enrollments: ReadonlyMap<string, EnrollmentFields>
    people: ReadonlyMap<string, PersonFields>
}

/**
 * The scheduled events a new enrolment brings, as event payloads, with the ids of its row's slot events: `slotEvents`
 * are the import's own events of the enrolment, by slot.
 */
export type ScheduledEvents = (
    enrollment: EnrollmentRecord,
    dates: { enrolledAt: string; occurredAt?: string },
    slotEvents: ReadonlyMap<string, string>
) => unknown[]

/** A flat tracker import: people, enrolments and events, each naming the one it belongs to. */
export interface TrackerPayload {
    trackedEntities: unknown[]
    enrollments: unknown[]
    events: unknown[]
}

/** Every object an import sends, by id: its kind, and the record it belongs to (an event's enrolment, an enrolment's person). */
export type SentObjects = ReadonlyMap<
    string,
    { kind: DataRecord['kind']; parent?: string }
>

const ENROLLED_AT = 'enrolledAt'
const INCIDENT_DATE = 'occurredAt'
const ENROLLMENT_DATES = new Set<string>([ENROLLED_AT, INCIDENT_DATE])

type EventPayload = EventFields & {
    dataValues: Array<{ dataElement: string; value: string | null }>
}

const scheduledEventSchema = z.object({
    event: z.string(),
    enrollment: z.string().optional(),
    scheduledAt: z.string().optional(),
})

const AS_IS = { escapeValue: false }

const withTime = (date: string, held: string | undefined) =>
    `${date}${held?.slice(10) ?? ''}`

const incidentDate = (
    change: OutboxRecord | undefined,
    held: string | undefined
) => {
    if (change === undefined) {
        return held
    }
    return change.value === null ? undefined : withTime(change.value, held)
}

/** The record a record belongs to: an event's enrolment, an enrolment's person. */
export const belongsTo = (record: DataRecord | undefined) => {
    switch (record?.kind) {
        case 'event':
            return record.enrollmentId
        case 'enrollment':
            return record.trackedEntityId
        default:
            return undefined
    }
}

/**
 * What to send of the records' changes, and the changes that wait or are refused before sending. A change to a
 * record DHIS2 holds updates it; one to a record made here creates it once what it depends on is there: a new person
 * waits for the mandatory attributes of its type and the program and for its enrolment's date, and goes with that
 * enrolment, never alone; a new enrolment waits for its date and its person; a new event for its date (a slot with no
 * date column takes the enrolment's), its stage's required fields when the stage checks on insert, and its
 * enrolment. Values typed into an event with no date wait with it, since DHIS2 refuses values on a scheduled event.
 * Clearing a date or a required value is refused, and so is a change to a record DHIS2 does not return that was not
 * made here as a new one, or that was saved here since (`remembered`).
 */
export const buildImport = (
    records: ReadonlyArray<OutboxRecord>,
    form: LoadedForm,
    held: HeldRecords,
    extra: {
        programId: string
        /** Records DHIS2 held when loaded or saved here: one it no longer returns is gone, not new. */
        remembered?: ReadonlySet<string>
        scheduledEvents?: ScheduledEvents
    }
) => {
    const { programId, remembered = new Set<string>() } = extra
    const columns = form.tables.flatMap((table) => table.columns)
    const nameOf = (field: string, slot?: string) => {
        if (slot === undefined && field === EVENT_DATE_COLUMN) {
            return i18n.t('Event date')
        }
        const named = (only: boolean) =>
            columns.find(
                (column) =>
                    (column.fieldId ?? column.id) === field &&
                    (!only || column.slot === slot)
            )
        return (named(true) ?? named(false))?.label ?? field
    }

    const byRecord = new Map<string, OutboxRecord[]>()
    for (const record of records) {
        const id = recordIdOf(record.key)
        byRecord.set(id, [...(byRecord.get(id) ?? []), record])
    }
    const changesOf = (id: string) => byRecord.get(id) ?? []
    const typedIn = (id: string, field: string) =>
        changesOf(id).find(({ key }) => fieldIdOfKey(key) === field)?.value ??
        undefined
    const recordOf = (id: string) =>
        changesOf(id).find(({ record }) => record?.isNew)?.record ??
        changesOf(id).find(({ record }) => record)?.record ??
        form.records.get(id)
    const newRecord = (id: string) => {
        const record = recordOf(id)
        return record?.isNew && !remembered.has(id) ? record : undefined
    }
    const requiredOf = (...forms: string[]) =>
        new Set(forms.flatMap((id) => [...(form.required.get(id) ?? [])]))

    const people: unknown[] = []
    const enrollments: unknown[] = []
    const events: EventPayload[] = []
    const objects = new Map<
        string,
        { kind: DataRecord['kind']; parent?: string }
    >()
    const waiting: SaveOutcome[] = []
    const blocked = new Map<string, string>()
    const decided = new Set<CellKey>()
    const hold = (
        changes: ReadonlyArray<OutboxRecord>,
        result: 'waiting' | 'failed',
        reason: string
    ) => {
        for (const { sourceKey, key } of changes) {
            if (!decided.has(key)) {
                decided.add(key)
                waiting.push({ sourceKey, key, result, reason })
            }
        }
    }
    const wait = (id: string, reason: string) => {
        blocked.set(id, reason)
        hold(changesOf(id), 'waiting', reason)
    }
    const slotOf = (id: string) => {
        const record = recordOf(id)
        return record?.kind === 'event' ? record.slot : undefined
    }
    const refuseCleared = (
        changes: ReadonlyArray<OutboxRecord>,
        required: ReadonlySet<string>
    ) => {
        const refused = changes.filter(
            ({ key, value }) =>
                value === null && required.has(fieldIdOfKey(key))
        )
        for (const change of refused) {
            const field = nameOf(
                fieldIdOfKey(change.key),
                slotOf(recordIdOf(change.key))
            )
            hold(
                [change],
                'failed',
                i18n.t('{{field}} is required', { field, interpolation: AS_IS })
            )
        }
        return changes.filter((change) => !refused.includes(change))
    }
    const refuseForeign = (changes: ReadonlyArray<OutboxRecord>) => {
        const foreign = changes.filter(
            ({ key }) => !ENROLLMENT_DATES.has(fieldIdOfKey(key))
        )
        for (const change of foreign) {
            hold(
                [change],
                'failed',
                i18n.t('{{field}} cannot be saved on an enrolment', {
                    field: nameOf(fieldIdOfKey(change.key)),
                    interpolation: AS_IS,
                })
            )
        }
        return changes.filter((change) => !foreign.includes(change))
    }
    const kindOf: (id: string) => DataRecord['kind'] = (id) => {
        if (held.people.has(id)) {
            return 'trackedEntity'
        }
        if (held.enrollments.has(id)) {
            return 'enrollment'
        }
        if (held.events.has(id)) {
            return 'event'
        }
        return recordOf(id)?.kind ?? 'event'
    }
    const ids = [...byRecord.keys()]
    const ofKind = (kind: DataRecord['kind']) =>
        ids.filter((id) => kindOf(id) === kind)
    const gone = (id: string, kind: DataRecord['kind']) => {
        if (newRecord(id)?.kind === kind) {
            return false
        }
        hold(changesOf(id), 'failed', goneReason(kind))
        return true
    }

    const newEnrollments = ofKind('enrollment').flatMap((id) => {
        const record = newRecord(id)
        return record?.kind === 'enrollment' && !held.enrollments.has(id)
            ? [record]
            : []
    })

    const newPeople = new Set<string>()
    for (const id of ofKind('trackedEntity')) {
        const base = held.people.get(id)
        if (base === undefined) {
            if (!gone(id, 'trackedEntity')) {
                newPeople.add(id)
            }
            continue
        }
        const sent = refuseCleared(
            changesOf(id),
            requiredOf(programId, base.trackedEntityType)
        )
        if (sent.length > 0) {
            people.push({
                ...base,
                attributes: sent.map(({ key, value }) => ({
                    attribute: fieldIdOfKey(key),
                    value,
                })),
            })
            objects.set(id, { kind: 'trackedEntity' })
        }
    }
    for (const { trackedEntityId } of newEnrollments) {
        if (
            !held.people.has(trackedEntityId) &&
            newRecord(trackedEntityId)?.kind === 'trackedEntity'
        ) {
            newPeople.add(trackedEntityId)
        }
    }
    for (const id of newPeople) {
        const person = newRecord(id)
        if (person?.kind !== 'trackedEntity') {
            continue
        }
        const attributes = changesOf(id).filter(({ value }) => value !== null)
        const filled = new Set(attributes.map(({ key }) => fieldIdOfKey(key)))
        const missing = [
            ...requiredOf(programId, person.trackedEntityTypeId),
        ].filter((field) => !filled.has(field) && !ENROLLMENT_DATES.has(field))
        const dated = newEnrollments.some(
            (enrollment) =>
                enrollment.trackedEntityId === id &&
                typedIn(enrollment.id, ENROLLED_AT) !== undefined
        )
        if (missing.length > 0 || !dated) {
            wait(
                id,
                waitingFor([
                    ...missing.map((attribute) => nameOf(attribute)),
                    ...(dated ? [] : [nameOf(ENROLLED_AT)]),
                ])
            )
            continue
        }
        people.push({
            trackedEntity: id,
            trackedEntityType: person.trackedEntityTypeId,
            orgUnit: person.orgUnitId,
            attributes: attributes.map(({ key, value }) => ({
                attribute: fieldIdOfKey(key),
                value,
            })),
        })
        objects.set(id, { kind: 'trackedEntity' })
    }

    const parentWait = (
        parent: string | undefined,
        kind: 'trackedEntity' | 'enrollment'
    ) => {
        if (
            parent === undefined ||
            objects.has(parent) ||
            (kind === 'trackedEntity'
                ? held.people.has(parent)
                : held.enrollments.has(parent))
        ) {
            return undefined
        }
        return (
            blocked.get(parent) ??
            (recordOf(parent)?.isNew ? waitingForParent(kind) : undefined)
        )
    }

    const scheduled: unknown[] = []
    for (const id of ofKind('enrollment')) {
        const base = held.enrollments.get(id)
        if (base !== undefined) {
            const sent = refuseCleared(
                refuseForeign(changesOf(id)),
                new Set([ENROLLED_AT])
            )
            if (sent.length === 0) {
                continue
            }
            const enrolledAt = typedIn(id, ENROLLED_AT)
            enrollments.push({
                ...base,
                enrolledAt:
                    enrolledAt === undefined
                        ? base.enrolledAt
                        : withTime(enrolledAt, base.enrolledAt),
                occurredAt: incidentDate(
                    sent.find(({ key }) => fieldIdOfKey(key) === INCIDENT_DATE),
                    base.occurredAt
                ),
            })
            objects.set(id, {
                kind: 'enrollment',
                parent: base.trackedEntity,
            })
            continue
        }
        const enrollment = newRecord(id)
        if (gone(id, 'enrollment') || enrollment?.kind !== 'enrollment') {
            continue
        }
        refuseForeign(changesOf(id))
        const enrolledAt = typedIn(id, ENROLLED_AT)
        if (enrolledAt === undefined) {
            wait(id, waitingFor([nameOf(ENROLLED_AT)]))
            continue
        }
        const reason = parentWait(enrollment.trackedEntityId, 'trackedEntity')
        if (reason !== undefined) {
            wait(id, reason)
            continue
        }
        const occurredAt = typedIn(id, INCIDENT_DATE)
        enrollments.push({
            enrollment: id,
            program: enrollment.programId,
            trackedEntity: enrollment.trackedEntityId,
            orgUnit: enrollment.orgUnitId,
            status: enrollment.status,
            enrolledAt,
            occurredAt: occurredAt ?? enrolledAt,
        })
        objects.set(id, {
            kind: 'enrollment',
            parent: enrollment.trackedEntityId,
        })
        const slotEvents = new Map(
            ids.flatMap((event) => {
                const record = recordOf(event)
                return record?.kind === 'event' &&
                    record.enrollmentId === id &&
                    record.slot !== undefined
                    ? [[record.slot, event] as const]
                    : []
            })
        )
        scheduled.push(
            ...(extra.scheduledEvents?.(
                enrollment,
                { enrolledAt, occurredAt },
                slotEvents
            ) ?? [])
        )
    }

    const requiredIn = (stage: string, status: EventStatus) =>
        form.strategy.get(stage) === 'ON_UPDATE_AND_INSERT' ||
        status === 'COMPLETED'
            ? (form.required.get(stage) ?? new Set<string>())
            : new Set<string>()
    const valuesOf = (changes: ReadonlyArray<OutboxRecord>) =>
        changes
            .filter(({ key }) => fieldIdOfKey(key) !== EVENT_DATE_COLUMN)
            .map(({ key, value }) => ({
                dataElement: fieldIdOfKey(key),
                value,
            }))

    const datedByEnrollment = (slot: string | undefined) =>
        slot !== undefined &&
        !columns.some(
            (column) =>
                column.slot === slot &&
                (column.fieldId ?? column.id) === EVENT_DATE_COLUMN
        )
    const enrolledAtOf = (enrollment: string | undefined) =>
        enrollment === undefined
            ? undefined
            : (typedIn(enrollment, ENROLLED_AT) ??
              held.enrollments.get(enrollment)?.enrolledAt)

    for (const id of ofKind('event')) {
        const date = typedIn(id, EVENT_DATE_COLUMN)
        const base = held.events.get(id)
        if (base !== undefined) {
            const sent = refuseCleared(
                changesOf(id),
                new Set([
                    EVENT_DATE_COLUMN,
                    ...requiredIn(base.programStage, base.status),
                ])
            )
            if (sent.length === 0) {
                continue
            }
            const fromEnrollment = datedByEnrollment(slotOf(id))
                ? enrolledAtOf(base.enrollment)
                : undefined
            const occurredAt =
                date === undefined
                    ? (base.occurredAt ?? fromEnrollment)
                    : withTime(date, base.occurredAt)
            if (occurredAt === undefined) {
                hold(
                    sent,
                    'waiting',
                    eventWait([nameOf(EVENT_DATE_COLUMN, slotOf(id))])
                )
                continue
            }
            events.push({
                ...base,
                status: base.status === 'SCHEDULE' ? 'ACTIVE' : base.status,
                occurredAt,
                dataValues: valuesOf(sent),
            })
            objects.set(id, { kind: 'event', parent: base.enrollment })
            continue
        }
        const event = newRecord(id)
        if (gone(id, 'event') || event?.kind !== 'event') {
            continue
        }
        const byEnrollment = datedByEnrollment(event.slot)
        const occurredAt = byEnrollment
            ? enrolledAtOf(event.enrollmentId)
            : date
        const filled = new Set(
            changesOf(id)
                .filter(({ value }) => value !== null)
                .map(({ key }) => fieldIdOfKey(key))
        )
        const missing = [
            ...(byEnrollment ? [] : [EVENT_DATE_COLUMN]),
            ...requiredIn(event.programStageId, 'ACTIVE'),
        ].filter((field) => !filled.has(field))
        if (missing.length > 0) {
            hold(
                changesOf(id),
                'waiting',
                eventWait(missing.map((field) => nameOf(field, event.slot)))
            )
            continue
        }
        const reason = parentWait(event.enrollmentId, 'enrollment')
        if (reason !== undefined || occurredAt === undefined) {
            hold(
                changesOf(id),
                'waiting',
                reason ?? waitingForParent('enrollment')
            )
            continue
        }
        events.push({
            event: id,
            program: programId,
            programStage: event.programStageId,
            orgUnit: event.orgUnitId,
            enrollment: event.enrollmentId,
            occurredAt,
            status: 'ACTIVE',
            ...(event.scheduledAt !== undefined && {
                scheduledAt: event.scheduledAt,
            }),
            dataValues: [
                ...Object.entries(event.createdWith ?? {})
                    .filter(
                        ([dataElement]) =>
                            !changesOf(id).some(
                                ({ key }) => fieldIdOfKey(key) === dataElement
                            )
                    )
                    .map(([dataElement, value]) => ({ dataElement, value })),
                ...valuesOf(changesOf(id)),
            ],
        })
        objects.set(id, { kind: 'event', parent: event.enrollmentId })
    }

    const brought: unknown[] = []
    for (const payload of scheduled) {
        const { event, enrollment, scheduledAt } =
            scheduledEventSchema.parse(payload)
        const dated = events.find((sent) => sent.event === event)
        if (dated === undefined) {
            brought.push(payload)
            objects.set(event, { kind: 'event', parent: enrollment })
        } else {
            dated.scheduledAt ??= scheduledAt
        }
    }

    const notSent = new Set(waiting.map(({ key }) => key))
    return {
        payload: {
            trackedEntities: people,
            enrollments,
            events: [...events, ...brought],
        } satisfies TrackerPayload,
        sent: records.filter(
            ({ key }) => objects.has(recordIdOf(key)) && !notSent.has(key)
        ),
        waiting,
        objects,
    }
}
