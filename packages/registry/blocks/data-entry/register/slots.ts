import i18n from '@dhis2/d2-i18n'
import type { SlotDef } from './compileLayout'

/** An event as loaded: what slot filling reads. */
export interface SlotEvent {
    id: string
    programStage: string
    occurredAt?: string
    scheduledAt?: string
    values: Readonly<Record<string, string>>
}

const dateOf = (event: SlotEvent) => event.occurredAt ?? event.scheduledAt ?? ''

// A date is `YYYY-MM-DD` or a date-time, so text order is date order; an event with no date goes last.
const byDate = (a: SlotEvent, b: SlotEvent) => {
    const [x, y] = [dateOf(a), dateOf(b)]
    if (x !== y) {
        // An empty date sorts last.
        const [left, right] = [x || '\uffff', y || '\uffff']
        return left < right ? -1 : 1
    }
    if (a.id === b.id) {
        return 0
    }
    // Ordinal, not locale, order.
    return a.id < b.id ? -1 : 1
}

/** The events each slot holds, by slot name, and what the register leaves out. */
export interface FilledSlots {
    bySlot: ReadonlyMap<string, string>
    notes: string[]
}

/**
 * Places a person's events into the register's slots: an event holding a `where` slot's values, else the stage's
 * `single` slot, else the nth visit of an `occurrence` slot by date. An event fills at most one slot. The notes say
 * what the register leaves out.
 */
export const fillSlots = (
    events: ReadonlyArray<SlotEvent>,
    slots: ReadonlyArray<SlotDef>
): FilledSlots => {
    const bySlot = new Map<string, string>()
    const notes: string[] = []
    const claimed = new Set<string>()
    const sorted = [...events].sort(byDate)
    const unclaimed = (stageId: string) =>
        sorted.filter((e) => e.programStage === stageId && !claimed.has(e.id))

    for (const slot of slots) {
        if (slot.kind !== 'where' || slot.stageId === undefined) {
            continue
        }
        const { where = {}, stageId } = slot
        const holding = unclaimed(stageId).filter((e) =>
            Object.entries(where).every(([id, code]) => e.values[id] === code)
        )
        const [first] = holding
        if (first === undefined) {
            continue
        }
        bySlot.set(slot.name, first.id)
        holding.forEach((e) => claimed.add(e.id))
        if (holding.length > 1) {
            notes.push(
                i18n.t(
                    '{{count}} events of {{stage}} hold {{values}}; the first is shown',
                    {
                        count: holding.length,
                        stage: slot.stageName,
                        values: slot.valuesLabel,
                        escapeValue: false,
                    }
                )
            )
        }
    }

    for (const slot of slots) {
        if (slot.kind !== 'single' || slot.stageId === undefined) {
            continue
        }
        const [first] = unclaimed(slot.stageId)
        if (first !== undefined) {
            bySlot.set(slot.name, first.id)
            claimed.add(first.id)
        }
    }

    // The nth visit among the events no `where` or `single` slot took, so a layout that skips a number leaves it empty.
    const rest = new Map<string, SlotEvent[]>()
    for (const slot of slots) {
        const { stageId, occurrence } = slot
        if (slot.kind !== 'occurrence' || stageId === undefined) {
            continue
        }
        const visits = rest.get(stageId) ?? unclaimed(stageId)
        rest.set(stageId, visits)
        const nth = visits[(occurrence ?? 1) - 1]
        if (nth !== undefined) {
            bySlot.set(slot.name, nth.id)
            claimed.add(nth.id)
        }
    }

    const reported = new Set<string>()
    for (const slot of slots) {
        const { stageId } = slot
        if (
            stageId === undefined ||
            reported.has(stageId) ||
            (slot.kind !== 'single' && slot.kind !== 'occurrence')
        ) {
            continue
        }
        reported.add(stageId)
        const count = unclaimed(stageId).length
        if (count > 0) {
            notes.push(
                i18n.t(
                    '{{count}} more visits of {{stage}} not in this register',
                    {
                        count,
                        stage: slot.stageName,
                        escapeValue: false,
                    }
                )
            )
        }
    }
    return { bySlot, notes }
}
