import type { LatestValue, TrackerEvent } from './types'

// Observations come from events that took place; scheduled, skipped and
// overdue events carry none (spec 9.1, as in Observation Cards).
const OBSERVED = new Set(['ACTIVE', 'COMPLETED'])

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/** Newest first by `occurredAt`, then `createdAt`; no `occurredAt` is oldest. */
const newestFirst = (a: TrackerEvent, b: TrackerEvent) =>
    compare(b.occurredAt ?? '', a.occurredAt ?? '') ||
    compare(b.createdAt, a.createdAt)

/**
 * Spec 9.1: for each data element, the value of the newest ACTIVE or
 * COMPLETED event that has a non-empty one, with that event. The caller picks
 * the scope by the events it passes; their order does not matter.
 */
export const latestValues = (
    events: readonly TrackerEvent[],
    dataElementIds?: readonly string[]
): Map<string, LatestValue> => {
    const wanted = dataElementIds && new Set(dataElementIds)
    const latest = new Map<string, LatestValue>()
    const observed = events
        .filter(({ status }) => OBSERVED.has(status))
        .sort(newestFirst)
    for (const event of observed) {
        for (const [id, value] of event.dataValues) {
            if (value === '' || latest.has(id)) continue
            if (wanted && !wanted.has(id)) continue
            latest.set(id, { value, event })
        }
    }
    return latest
}
