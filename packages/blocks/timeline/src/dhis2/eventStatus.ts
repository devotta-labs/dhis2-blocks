import { storedDay } from '@/registry/dhis2/value-display/calendar'
import type { TrackerEvent } from './schemas'

export type DerivedEventStatus =
    | 'completed'
    | 'active'
    | 'scheduled'
    | 'overdue'
    | 'skipped'

/**
 * The status the timeline shows, as Capture decides it. A SCHEDULE event whose
 * stored due day is before `today` (`YYYY-MM-DD`) is overdue, as is a stored
 * legacy OVERDUE. Days compare as stored, never through `Date`.
 */
export const deriveEventStatus = (
    event: Pick<TrackerEvent, 'status' | 'scheduledAt'>,
    today: string
): DerivedEventStatus => {
    switch (event.status) {
        case 'COMPLETED':
            return 'completed'
        case 'SKIPPED':
            return 'skipped'
        case 'OVERDUE':
            return 'overdue'
        case 'SCHEDULE': {
            const due =
                event.scheduledAt === undefined
                    ? undefined
                    : storedDay(event.scheduledAt)
            return due !== undefined && due < today ? 'overdue' : 'scheduled'
        }
        default:
            // ACTIVE, VISITED, and any status a newer server adds.
            return 'active'
    }
}
