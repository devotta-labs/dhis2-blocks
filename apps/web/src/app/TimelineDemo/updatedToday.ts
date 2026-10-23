import {
    EVENT_FIELDS,
    EventsPageSchema,
    type TimelineClient,
    type TrackerEvent,
} from '@/components/timeline-dhis2'
import type { Result } from 'better-result'

export interface UpdatedTodayOptions {
    program: string
    orgUnit: string
    /** The viewer's day as `YYYY-MM-DD`. */
    today: string
    page: number
    pageSize: number
}

export interface UpdatedTodayPage {
    events: TrackerEvent[]
    /** The next page to ask for; undefined after a short page. */
    nextPage?: number
}

const pad = (value: number) => value.toString().padStart(2, '0')

/** The calendar day after `day` (`YYYY-MM-DD`), by date arithmetic only. */
const nextDay = (day: string): string => {
    const [year = 0, month = 1, date = 1] = day.split('-').map(Number)
    const next = new Date(Date.UTC(year, month - 1, date + 1))
    return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`
}

/**
 * One page of the events of one program in one org unit that were updated
 * today, newest update first. A host's own server-paged source: one source
 * pages on its own, so `useInfiniteQuery` is all it needs.
 */
export const fetchUpdatedToday = async (
    client: TimelineClient,
    { program, orgUnit, today, page, pageSize }: UpdatedTodayOptions,
    signal?: AbortSignal
): Promise<Result<UpdatedTodayPage, Error>> => {
    const result = await client.query(
        {
            resource: 'tracker/events',
            params: {
                program,
                orgUnit,
                updatedAfter: `${today}T00:00:00`,
                updatedBefore: `${nextDay(today)}T00:00:00`,
                fields: EVENT_FIELDS,
                order: 'updatedAt:desc,event:asc',
                page,
                pageSize,
            },
        },
        EventsPageSchema,
        signal
    )
    // "More pages" is "the page came back full".
    return result.map((events) =>
        events.length < pageSize ? { events } : { events, nextPage: page + 1 }
    )
}
