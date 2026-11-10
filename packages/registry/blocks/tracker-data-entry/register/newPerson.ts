import i18n from '@dhis2/d2-i18n'
import { z } from 'zod'
import { cellKey } from '@/components/spreadsheet'
import type { CellKey, DataEngine } from '@/components/spreadsheet'
import type {
    EnrollmentRecord,
    EventRecord,
    PersonRecord,
    TrackerRow,
} from '../model/types'
import { generateUid } from '../sources/uid'
import type { CompiledLayout, SlotDef } from './compileLayout'
import type { RegisterMetadata } from './metadata'

type EventSlot = SlotDef & { stageId: string }

const isEventSlot = (slot: SlotDef): slot is EventSlot =>
    slot.stageId !== undefined

/** The new event an empty slot gets, made with the values its `where` holds. */
const slotEvent = (
    slot: EventSlot,
    enrollment: EnrollmentRecord
): EventRecord => ({
    kind: 'event',
    id: generateUid(),
    programStageId: slot.stageId,
    orgUnitId: enrollment.orgUnitId,
    enrollmentId: enrollment.id,
    status: 'ACTIVE',
    isNew: true,
    slot: slot.name,
    ...(slot.where !== undefined && { createdWith: slot.where }),
    ...(enrollment.isNew && { trackedEntityId: enrollment.trackedEntityId }),
})

/**
 * A person's row: its id is the enrolment's, its slots name the person, the enrolment and each event slot's event
 * (`filled`, else a new one), and the layout's row label cells name it. The records are in slot order.
 */
export const personRow = (
    compiled: CompiledLayout,
    person: PersonRecord,
    enrollment: EnrollmentRecord,
    filled: (slot: SlotDef) => EventRecord | undefined,
    label: string
) => {
    const events = compiled.slots
        .filter(isEventSlot)
        .map(
            (slot) =>
                [
                    slot.name,
                    filled(slot) ?? slotEvent(slot, enrollment),
                ] as const
        )
    const slots = Object.fromEntries([
        ['person', person.id] as const,
        ['enrollment', enrollment.id] as const,
        ...events.map(([name, { id }]) => [name, id] as const),
    ])
    return {
        row: {
            id: enrollment.id,
            label,
            slots,
            labelFrom: compiled.rowLabel.map(({ slot, fieldId }) =>
                cellKey(slots[slot], fieldId)
            ),
        } satisfies TrackerRow,
        records: [person, enrollment, ...events.map(([, event]) => event)],
    }
}

/** A row's name: its label cells' values, joined by a space; empty when none has one. */
export const nameOf = (
    row: TrackerRow,
    valueOf: (key: CellKey) => string | undefined
) =>
    (row.labelFrom ?? [])
        .map(valueOf)
        .filter((value) => value !== undefined && value !== '')
        .join(' ')

/**
 * A new person's row at the org unit: the person, the enrolment and an event per event slot. What is `given` (a row
 * restored after a reload: its records, or only the ids its other records name) keeps its ids; the rest get device
 * ids.
 */
export const newPerson = (
    compiled: CompiledLayout,
    metadata: RegisterMetadata,
    orgUnitId: string,
    given: {
        personId?: string
        enrollmentId?: string
        person?: PersonRecord
        enrollment?: EnrollmentRecord
        events?: ReadonlyMap<string, EventRecord>
    } = {}
) => {
    const person: PersonRecord = given.person ?? {
        kind: 'trackedEntity',
        id: given.personId ?? generateUid(),
        trackedEntityTypeId: metadata.trackedEntityTypeId,
        orgUnitId,
        isNew: true,
    }
    const enrollment: EnrollmentRecord = given.enrollment ?? {
        kind: 'enrollment',
        id: given.enrollmentId ?? generateUid(),
        programId: metadata.programId,
        trackedEntityId: person.id,
        orgUnitId,
        status: 'ACTIVE',
        isNew: true,
    }
    return personRow(
        compiled,
        person,
        enrollment,
        (slot) => given.events?.get(slot.name),
        i18n.t('New person')
    )
}

// DHIS2 keeps a reserved value 60 days, which outlasts an outbox that waits.
const RESERVE = 10
const REFILL_BELOW = 3

const reservedSchema = z.object({
    reserved: z.array(z.object({ value: z.string() })),
})

/**
 * Values DHIS2 reserves for the program's generated attributes, ten per attribute; each new person takes one of each,
 * and an attribute with fewer than three left asks for more in the background. With none left, a new person gets
 * none: its cell stays empty, and required if the attribute is.
 */
export const reservedValues = (attributeIds: ReadonlyArray<string>) => {
    const pools = new Map<string, string[]>(attributeIds.map((id) => [id, []]))
    const asking = new Set<string>()
    const refill = async (
        engine: DataEngine,
        id: string,
        signal?: AbortSignal
    ) => {
        const pool = pools.get(id)
        if (pool === undefined || asking.has(id) || pool.length >= RESERVE) {
            return
        }
        asking.add(id)
        try {
            const answer = await engine.query(
                {
                    reserved: {
                        resource: `trackedEntityAttributes/${id}/generateAndReserve`,
                        params: { numberToReserve: RESERVE - pool.length },
                    },
                },
                { signal }
            )
            pool.push(
                ...reservedSchema
                    .parse(answer)
                    .reserved.map(({ value }) => value)
            )
        } catch (error) {
            // A value that cannot be reserved (no pattern, no access) only leaves the cell for the clerk.
            if (signal?.aborted) {
                throw error
            }
        } finally {
            asking.delete(id)
        }
    }
    return {
        /** Tops every attribute up to ten. */
        fill: async (engine: DataEngine, signal?: AbortSignal) => {
            await Promise.all(
                attributeIds.map((id) => refill(engine, id, signal))
            )
        },
        /** One value of each attribute that has any left, by attribute id. */
        take(engine: DataEngine) {
            const values = new Map<string, string>()
            for (const [id, pool] of pools) {
                const value = pool.shift()
                if (value !== undefined) {
                    values.set(id, value)
                }
                if (pool.length < REFILL_BELOW) {
                    void refill(engine, id)
                }
            }
            return values
        },
    }
}
