import type { DerivedEventStatus, TrackerEvent } from './types'

/** The `YYYY-MM-DD` a stored date or timestamp starts with. */
const storedDay = (stored: string) => stored.slice(0, 10)

/**
 * Spec 9.2, the same rule as Timeline v2's `deriveEventStatus`: the server
 * never stores overdue, so a SCHEDULE event whose stored due day is before
 * `today` is overdue. Days compare as stored strings, never through `Date`,
 * so time zones can't shift them.
 */
export const eventStatus = (
    event: TrackerEvent,
    today: string
): DerivedEventStatus => {
    switch (event.status) {
        case 'COMPLETED':
            return 'completed'
        case 'SKIPPED':
            return 'skipped'
        case 'OVERDUE':
            return 'overdue'
        case 'SCHEDULE':
            return event.scheduledAt !== undefined &&
                storedDay(event.scheduledAt) < storedDay(today)
                ? 'overdue'
                : 'scheduled'
        default:
            // ACTIVE, VISITED and statuses this block doesn't know
            return 'active'
    }
}

export const isOverdue = (event: TrackerEvent, today: string): boolean =>
    eventStatus(event, today) === 'overdue'

const pad = (value: number) => String(value).padStart(2, '0')

/** The user's local date as `YYYY-MM-DD`. */
export const todayIso = (): string => {
    const now = new Date()
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}
