import type { TimelineEntry } from '../core/types'
import { deriveEventStatus, type DerivedEventStatus } from './eventStatus'
import type { EventTimeField } from './queries'
import type { TrackerEvent } from './schemas'

export interface EventEntryData {
    event: TrackerEvent
    status: DerivedEventStatus
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

/**
 * An event on the timeline. Scheduled, overdue and skipped events sit at their
 * `scheduledAt`; the others at `timeField`. A missing value gives `at: ''`,
 * which the feed shows as Undated.
 */
export const toEventEntry = (
    event: TrackerEvent,
    options: { sourceKey: string; timeField: EventTimeField; today: string }
): TimelineEntry<EventEntryData> => {
    const status = deriveEventStatus(event, options.today)
    const byScheduledAt =
        status === 'scheduled' || status === 'overdue' || status === 'skipped'
    const at =
        (byScheduledAt ? event.scheduledAt : event[options.timeField]) ?? ''
    return {
        id: `events:${event.event}`,
        at,
        precision: DATE_ONLY.test(at) ? 'day' : 'instant',
        phase:
            status === 'scheduled'
                ? 'future'
                : status === 'overdue'
                  ? 'overdue'
                  : 'past',
        sourceKey: options.sourceKey,
        data: { event, status },
    }
}
