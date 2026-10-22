import {
    EVENT_FIELDS,
    EventsPageSchema,
    toEventEntry,
    type EventEntryData,
    type TimelineClient,
} from '@dhis2-blocks/timeline/dhis2'
import type { SourceError, TimelineSource } from '@dhis2-blocks/timeline'
import i18n from '../../i18n'
import { Result } from 'better-result'
import { z } from 'zod'

export interface UpdatedTodaySourceOptions {
    client: TimelineClient
    program: string
    orgUnit: string
    /** The viewer's day as `YYYY-MM-DD`. */
    today: string
    pageSize?: number
}

const pad = (value: number) => value.toString().padStart(2, '0')

/** The calendar day after `day` (`YYYY-MM-DD`), by date arithmetic only. */
const nextDay = (day: string): string => {
    const [year = 0, month = 1, date = 1] = day.split('-').map(Number)
    const next = new Date(Date.UTC(year, month - 1, date + 1))
    return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`
}

/**
 * A bring-your-own source: events of one program in one org unit that were
 * updated today, newest update first. It reuses the events response schema
 * and `toEventEntry` with `sourceKey: 'events'`, so the case-history event
 * composition renders its entries as they are.
 */
export const updatedTodaySource = ({
    client,
    program,
    orgUnit,
    today,
    pageSize = 50,
}: UpdatedTodaySourceOptions): TimelineSource<EventEntryData> => ({
    key: 'events',
    label: i18n.t('Events'),
    async fetchPage(cursor, signal) {
        const page = z.number().safeParse(cursor).data ?? 1
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
        if (Result.isError(result)) {
            const error: SourceError = { kind: 'failed', error: result.error }
            return Result.err(error)
        }
        const events = result.value
        const entries = events.map((event) =>
            toEventEntry(event, {
                sourceKey: 'events',
                timeField: 'updatedAt',
                today,
            })
        )
        // "More pages" is "the page came back full".
        if (events.length < pageSize) {
            return Result.ok({ entries })
        }
        return Result.ok({
            entries,
            nextCursor: page + 1,
            completeUntil: events.at(-1)?.updatedAt,
        })
    },
})
