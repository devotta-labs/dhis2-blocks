import i18n from '@dhis2/d2-i18n'
import { z } from 'zod'
import type { CellKey, DataEngine } from '@/components/spreadsheet'
import type {
    DataRecord,
    EnrollmentRecord,
    EventRecord,
    PersonRecord,
} from '../model/types'
import type { OutboxRecord } from '../outbox/outbox'
import type { SlotDef } from './compileLayout'
import { fillSlots } from './slots'
import type { SlotEvent } from './slots'

/** A new person the outbox holds changes for: the ids its changes name, and the records they were made with. */
export interface UnsentPerson {
    personId: string
    enrollmentId?: string
    person?: PersonRecord
    enrollment?: EnrollmentRecord
    /** Its slot events, by slot. */
    events: Map<string, EventRecord>
}

/**
 * What the outbox holds of records made here that DHIS2 did not hold (`remembered` are those it did): the new people,
 * grouped by person from their own records, their enrolment's and their slot events' (so a row comes back with the
 * ids its changes name, whichever of them were typed in); the slot events of people a page loads; and the values
 * typed, by cell.
 */
export const unsentRecords = (
    outbox: ReadonlyArray<OutboxRecord>,
    {
        programId,
        remembered,
        slotNames,
    }: {
        programId: string
        remembered: ReadonlySet<string>
        slotNames: ReadonlySet<string>
    }
) => {
    // Each new record as its latest change made it, in the order made.
    const made = new Map<string, DataRecord>()
    const typed = new Map<CellKey, string>()
    for (const { key, value, record } of [...outbox].sort(
        (a, b) => a.at - b.at
    )) {
        if (value === null) {
            typed.delete(key)
        } else {
            typed.set(key, value)
        }
        if (record?.isNew && !remembered.has(record.id)) {
            made.set(record.id, record)
        }
    }

    const people = new Map<string, UnsentPerson>()
    const personOf = (personId: string): UnsentPerson => {
        const known = people.get(personId) ?? { personId, events: new Map() }
        people.set(personId, known)
        return known
    }
    const personOfEnrollment = new Map<string, string>()
    for (const record of made.values()) {
        if (record.kind === 'trackedEntity') {
            personOf(record.id).person = record
        } else if (
            record.kind === 'enrollment' &&
            record.programId === programId
        ) {
            const person = personOf(record.trackedEntityId)
            person.enrollment = record
            person.enrollmentId = record.id
            personOfEnrollment.set(record.id, record.trackedEntityId)
        }
    }
    const loadedPeopleEvents: Array<{
        enrollmentId: string
        slot: string
        event: EventRecord
    }> = []
    for (const record of made.values()) {
        if (
            record.kind !== 'event' ||
            record.enrollmentId === undefined ||
            record.slot === undefined ||
            !slotNames.has(record.slot)
        ) {
            continue
        }
        const personId =
            record.trackedEntityId ??
            personOfEnrollment.get(record.enrollmentId)
        if (personId === undefined) {
            loadedPeopleEvents.push({
                enrollmentId: record.enrollmentId,
                slot: record.slot,
                event: record,
            })
            continue
        }
        const person = personOf(personId)
        person.enrollmentId ??= record.enrollmentId
        person.events.set(record.slot, record)
    }
    return { people: [...people.values()], loadedPeopleEvents, typed }
}

const heldEnrollmentSchema = z.object({
    enrollment: z.string(),
    program: z.string().optional(),
    status: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED']),
    events: z
        .array(
            z.object({
                event: z.string(),
                programStage: z.string(),
                occurredAt: z.string().optional(),
                scheduledAt: z.string().optional(),
                dataValues: z
                    .array(
                        z.object({ dataElement: z.string(), value: z.string() })
                    )
                    .default([]),
            })
        )
        .default([]),
})
const HELD_ENROLLMENT_FIELDS =
    'enrollment,program,status,events[event,programStage,occurredAt,scheduledAt,dataValues[dataElement,value]]'
const heldPeopleSchema = z.object({
    held: z.object({
        trackedEntities: z.array(
            z.object({
                trackedEntity: z.string(),
                enrollments: z.array(heldEnrollmentSchema).default([]),
            })
        ),
    }),
})
const heldEnrollmentsSchema = z.object({
    held: z.object({ enrollments: z.array(heldEnrollmentSchema) }),
})

/** An enrolment as DHIS2 holds it: its status and its events, as slot filling reads them. */
export interface HeldEnrollment {
    enrollment: string
    status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
    events: SlotEvent[]
}

const heldOf = ({
    enrollment,
    status,
    events,
}: z.infer<typeof heldEnrollmentSchema>): HeldEnrollment => ({
    enrollment,
    status,
    events: events.map((event) => ({
        id: event.event,
        programStage: event.programStage,
        occurredAt: event.occurredAt,
        scheduledAt: event.scheduledAt,
        values: Object.fromEntries(
            event.dataValues.map(({ dataElement, value }) => [
                dataElement,
                value,
            ])
        ),
    })),
})

// Ids per request, so each stays well within URL limits.
const CHUNK = 100

/** How long a reload waits for DHIS2's answer about unsent changes before they wait unsent: the form opens after it. */
export const RESTORE_TIMEOUT = 15_000

/**
 * What DHIS2 holds of the people and enrolments unsent changes name: each person's enrolment in the program (`null`
 * for a person DHIS2 holds without one), and each enrolment, 100 ids a request. Throws when DHIS2 cannot be asked.
 */
export const readHeld = async (
    engine: DataEngine,
    {
        programId,
        trackedEntityTypeId,
        personIds,
        enrollmentIds,
    }: {
        programId: string
        trackedEntityTypeId: string
        personIds: ReadonlyArray<string>
        enrollmentIds: ReadonlyArray<string>
    },
    signal: AbortSignal
) => {
    const people = new Map<string, HeldEnrollment | null>()
    for (let at = 0; at < personIds.length; at += CHUNK) {
        const chunk = personIds.slice(at, at + CHUNK)
        const answer = await engine.query(
            {
                held: {
                    resource: 'tracker/trackedEntities',
                    params: {
                        trackedEntityType: trackedEntityTypeId,
                        trackedEntities: chunk.join(','),
                        fields: `trackedEntity,enrollments[${HELD_ENROLLMENT_FIELDS}]`,
                        pageSize: chunk.length,
                    },
                },
            },
            { signal }
        )
        for (const { trackedEntity, enrollments } of heldPeopleSchema.parse(
            answer
        ).held.trackedEntities) {
            const ofProgram = enrollments.find(
                ({ program }) => program === programId
            )
            people.set(trackedEntity, ofProgram ? heldOf(ofProgram) : null)
        }
    }
    const enrollments = new Map<string, HeldEnrollment>()
    for (let at = 0; at < enrollmentIds.length; at += CHUNK) {
        const chunk = enrollmentIds.slice(at, at + CHUNK)
        const answer = await engine.query(
            {
                held: {
                    resource: 'tracker/enrollments',
                    params: {
                        program: programId,
                        enrollments: chunk.join(','),
                        fields: HELD_ENROLLMENT_FIELDS,
                        pageSize: chunk.length,
                    },
                },
            },
            { signal }
        )
        for (const held of heldEnrollmentsSchema.parse(answer).held
            .enrollments) {
            enrollments.set(held.enrollment, heldOf(held))
        }
    }
    return { people, enrollments }
}

/** Why a restored event cannot take its slot: another event fills it now. */
export const slotTaken = () =>
    i18n.t('Another event fills this slot now; this change was not saved')

/**
 * Why a restored slot event cannot go into an enrolment DHIS2 holds: `rowReason` (the enrolment is read-only), else
 * another of its events fills the slot. None when the event is free to save, or DHIS2 holds it already.
 */
export const heldSlotRefusal = (
    held: HeldEnrollment,
    event: EventRecord,
    slots: ReadonlyArray<SlotDef>,
    rowReason: string | undefined
) => {
    // DHIS2 holds the event: its changes are ordinary updates, wherever DHIS2 ranks it now.
    if (held.events.some(({ id }) => id === event.id)) {
        return undefined
    }
    if (rowReason !== undefined) {
        return rowReason
    }
    const filling = fillSlots(held.events, slots).bySlot.get(event.slot ?? '')
    return filling === undefined || filling === event.id
        ? undefined
        : slotTaken()
}

// The platform's `FetchError` for no network, or for a request aborted (no answer in time).
const unreachableSchema = z.object({ type: z.enum(['network', 'aborted']) })

/**
 * Why changes wait unsent when DHIS2 could not be asked about them: no network (or no answer in time), which a reload
 * online mends; or DHIS2's own failure, said as it is.
 */
export const uncheckedReason = (error: Error) =>
    unreachableSchema.safeParse(error).success
        ? i18n.t(
              'Not checked with DHIS2 yet. Reload the page when you are online.'
          )
        : i18n.t('Could not check these changes with DHIS2: {{reason}}', {
              nsSeparator: '::',
              reason: error.message,
              interpolation: { escapeValue: false },
          })
