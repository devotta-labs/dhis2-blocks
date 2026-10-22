import i18n from '@dhis2/d2-i18n'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Result } from 'better-result'
import { useMemo } from 'react'
import { z } from 'zod'
import type { SourceError, SourcePage, TimelineSource } from '../core/types'
import {
    fetchEventsPage,
    fetchPinnedEvents,
    type EventTimeField,
} from './queries'
import type { EventsPage } from './schemas'
import { timelineKeys } from './timelineKeys'
import { toEventEntry, type EventEntryData } from './toEventEntry'
import { useTimelineClient } from './useTimelineClient'

export interface TrackedEntityEventsSourceOptions {
    trackedEntity: string
    program: string
    timeField: EventTimeField
    pageSize?: number
    /** Most scheduled, overdue and skipped events shown; more adds a notice. */
    scheduledCap?: number
    /** The current moment; for tests. */
    now?: Date
}

/** The cursor this source hands out: the number of the next past page. */
const CursorSchema = z.number().int().min(2)

const pad = (value: number) => value.toString().padStart(2, '0')

/** The local calendar day of `now` as `YYYY-MM-DD`. */
const dayOf = (now: Date) =>
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`

const unwrap = <T>(result: Result<T, Error>): T => {
    if (Result.isError(result)) {
        throw result.error
    }
    return result.value
}

const failed = (cause: unknown): SourceError => ({
    kind: 'failed',
    error: cause instanceof Error ? cause : new Error(String(cause)),
})

/**
 * Events of one tracked entity in one program. The first page carries the
 * scheduled, overdue and skipped events (so the feed stays append-only) and
 * the first page of the past stream; its request is cached under
 * `timelineKeys.events`, and its `dataUpdatedAt` is the source's `revision`,
 * so invalidating `timelineKeys.root` restarts the source.
 */
export const useTrackedEntityEventsSource = ({
    trackedEntity,
    program,
    timeField,
    pageSize = 50,
    scheduledCap = 50,
    now,
}: TrackedEntityEventsSourceOptions): TimelineSource<EventEntryData> => {
    const client = useTimelineClient()
    const queryClient = useQueryClient()

    const firstPage = useMemo(
        () => ({
            queryKey: timelineKeys.events(trackedEntity, program, timeField),
            retry: false,
            queryFn: async ({ signal }: { signal: AbortSignal }) => {
                const [pinned, past] = await Promise.all([
                    fetchPinnedEvents(
                        client,
                        { trackedEntity, program, cap: scheduledCap },
                        signal
                    ),
                    fetchEventsPage(
                        client,
                        {
                            trackedEntity,
                            program,
                            timeField,
                            page: 1,
                            pageSize,
                        },
                        signal
                    ),
                ])
                return { pinned: unwrap(pinned), past: unwrap(past) }
            },
        }),
        [client, trackedEntity, program, timeField, pageSize, scheduledCap]
    )

    // Observes the first page so the source restarts when it is refreshed.
    const { dataUpdatedAt } = useQuery(firstPage)
    const revision = dataUpdatedAt === 0 ? undefined : dataUpdatedAt

    return useMemo((): TimelineSource<EventEntryData> => {
        const entriesOf = (events: EventsPage['events'], today: string) =>
            events.map((event) =>
                toEventEntry(event, { sourceKey: 'events', timeField, today })
            )

        /** The past stream's part of a page. */
        const pastPage = (
            past: EventsPage,
            page: number,
            today: string
        ): SourcePage<EventEntryData> => {
            const result: SourcePage<EventEntryData> = {
                entries: entriesOf(past.events, today),
            }
            if (past.hasMore) {
                result.nextCursor = page + 1
                // From the last raw row, not the last kept entry: a full page
                // may keep few or none.
                result.completeUntil = past.lastAt
            }
            return result
        }

        return {
            key: 'events',
            label: i18n.t('Events'),
            revision,
            async fetchPage(cursor, signal) {
                const today = dayOf(now ?? new Date())
                try {
                    if (cursor === undefined) {
                        // Shares the cached or in-flight request the observer
                        // above is waiting on.
                        const { pinned, past } = await queryClient.fetchQuery({
                            ...firstPage,
                            staleTime: Infinity,
                        })
                        const page = pastPage(past, 1, today)
                        page.entries = [
                            ...entriesOf(pinned.events, today),
                            ...page.entries,
                        ]
                        if (pinned.hasMore) {
                            page.notice = i18n.t(
                                "More scheduled events aren't shown."
                            )
                        }
                        return Result.ok(page)
                    }
                    const page = CursorSchema.parse(cursor)
                    const past = unwrap(
                        await fetchEventsPage(
                            client,
                            {
                                trackedEntity,
                                program,
                                timeField,
                                page,
                                pageSize,
                            },
                            signal
                        )
                    )
                    return Result.ok(pastPage(past, page, today))
                } catch (cause) {
                    return Result.err(failed(cause))
                }
            },
        }
    }, [
        revision,
        firstPage,
        queryClient,
        client,
        trackedEntity,
        program,
        timeField,
        pageSize,
        now,
    ])
}
