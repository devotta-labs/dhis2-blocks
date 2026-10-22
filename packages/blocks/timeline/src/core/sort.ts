import { storedDay } from '@/registry/dhis2/value-display/calendar'
import type { TimelineEntry, TimelineOrder } from './types'

const STORED_CLOCK =
    /^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?/

/**
 * A text key that sorts chronologically: `YYYY-MM-DDTHH:mm:ss.sss`, taken from
 * the stored text with no time-zone shift. Missing parts are zero. Undefined
 * when the stored day is unreadable.
 */
export const sortKey = (entry: TimelineEntry): string | undefined => {
    const day = storedDay(entry.at)
    if (day === undefined) {
        return undefined
    }
    const clock = STORED_CLOCK.exec(entry.at)
    if (clock === null) {
        return `${day}T00:00:00.000`
    }
    const [, hours, minutes, seconds = '00', fraction = ''] = clock
    return `${day}T${hours}:${minutes}:${seconds}.${fraction.padEnd(3, '0').slice(0, 3)}`
}

// '!' sorts before every digit, so a day-precision entry is the earliest
// moment of its day: first when ascending, last once the order is reversed.
const comparableKey = (entry: TimelineEntry): string | undefined =>
    entry.precision === 'day'
        ? `${storedDay(entry.at) ?? ''}T!`
        : sortKey(entry)

const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/**
 * Chronological comparator, newest first for `desc`. Entries with an unreadable
 * `at` come last in both orders. Ties break on sequence, sourceKey, then id,
 * the same way in both orders.
 */
export const compareEntries =
    (order: TimelineOrder) =>
    (a: TimelineEntry, b: TimelineEntry): number => {
        const keyA = sortKey(a) === undefined ? undefined : comparableKey(a)
        const keyB = sortKey(b) === undefined ? undefined : comparableKey(b)
        if (keyA === undefined || keyB === undefined) {
            if (keyA === keyB) {
                return 0
            }
            return keyA === undefined ? 1 : -1
        }
        const byTime = compareText(keyA, keyB)
        if (byTime !== 0) {
            return order === 'asc' ? byTime : -byTime
        }
        return (
            (a.sequence ?? 0) - (b.sequence ?? 0) ||
            compareText(a.sourceKey, b.sourceKey) ||
            compareText(a.id, b.id)
        )
    }
