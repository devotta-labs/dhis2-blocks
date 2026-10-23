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
import type { EventsPage, TrackerEvent } from './schemas'
import { timelineKeys } from './timelineKeys'
import { toEventEntry, type EventEntryData } from './toEventEntry'
import { useQueryRevision } from './useQueryRevision'
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

/**
 * The cursor this source hands out: the next past page; whether the cap cut
 * scheduled or skipped events off (the merge replaces a source's notice with
 * each page's, so every page repeats it); and the events at the last page's
 * oldest time, held back because more at that time may follow, with that time.
 */
const CursorSchema = z.object({
    page: z.number().int().min(2),
    scheduleCapped: z.boolean(),
    skippedCapped: z.boolean(),
    carry: z.array(z.custom<TrackerEvent>()),
    boundary: z.string().optional(),
})

type Cursor = z.infer<typeof CursorSchema>

const noticeOf = ({
    scheduleCapped,
    skippedCapped,
}: Pick<Cursor, 'scheduleCapped' | 'skippedCapped'>) => {
    const notices = [
        ...(scheduleCapped
            ? [i18n.t("More scheduled events aren't shown.")]
            : []),
        ...(skippedCapped ? [i18n.t("More skipped events aren't shown.")] : []),
    ]
    return notices.length === 0 ? undefined : notices.join(' ')
}

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
 * `timelineKeys.events`, and its settles drive the source's `revision`,
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
            // Only invalidating timelineKeys.root refreshes the first page:
            // a refetch restarts the source and drops the pages loaded so far.
            staleTime: Infinity,
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
            refetchOnMount: false,
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
    useQuery(firstPage)
    // Changes each time the query's data is updated after it first settled
    // (a refetch after invalidation, also after a failed first page), so the
    // source refreshes; a failed refetch does not change it.
    const revision = useQueryRevision(firstPage.queryKey)
    // Another tracked entity, program or time field starts the source afresh.
    const subject = JSON.stringify(firstPage.queryKey)

    return useMemo((): TimelineSource<EventEntryData> => {
        const entriesOf = (events: EventsPage['events'], today: string) =>
            events.map((event) =>
                toEventEntry(event, { sourceKey: 'events', timeField, today })
            )

        /**
         * The past stream's part of a page. A full page holds back its events
         * at the last raw row's time (more at that time may follow on the next
         * page) and claims complete only down to the oldest event it shows.
         */
        const pastPage = (
            past: EventsPage,
            page: number,
            capped: Pick<Cursor, 'scheduleCapped' | 'skippedCapped'>,
            today: string
        ): SourcePage<EventEntryData> => {
            const result: SourcePage<EventEntryData> = {
                entries: entriesOf(past.events, today),
            }
            const notice = noticeOf(capped)
            if (notice !== undefined) {
                result.notice = notice
            }
            if (!past.hasMore) {
                return result
            }
            const boundary = past.lastAt
            const held = (event: TrackerEvent) =>
                boundary !== undefined && event[timeField] === boundary
            const emitted = past.events.filter((event) => !held(event))
            const cursor: Cursor = {
                page: page + 1,
                scheduleCapped: capped.scheduleCapped,
                skippedCapped: capped.skippedCapped,
                carry: past.events.filter(held),
                boundary,
            }
            result.entries = entriesOf(emitted, today)
            result.nextCursor = cursor
            // None shown (one time filled the page) claims nothing.
            const oldestShown = emitted.reduce<string | undefined>(
                (min, event) => {
                    const at = event[timeField]
                    return at !== undefined && (min === undefined || at < min)
                        ? at
                        : min
                },
                undefined
            )
            if (oldestShown !== undefined) {
                result.completeUntil = oldestShown
            }
            return result
        }

        /** The held-back events, then the rows of the next page not yet seen. */
        const withCarry = (past: EventsPage, cursor: Cursor): EventsPage => {
            const carried = new Set(cursor.carry.map((event) => event.event))
            const { boundary } = cursor
            // Rows newer than the boundary were shown already; they reappear
            // when new events shift the offset pages.
            const fresh = past.events.filter((event) => {
                if (carried.has(event.event)) {
                    return false
                }
                if (boundary === undefined) {
                    return true
                }
                const at = event[timeField]
                return at !== undefined && at <= boundary
            })
            return { ...past, events: [...cursor.carry, ...fresh] }
        }

        return {
            key: 'events',
            label: i18n.t('Events'),
            revision,
            subject,
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
                        const page = pastPage(past, 1, pinned, today)
                        page.entries = [
                            ...entriesOf(pinned.events, today),
                            ...page.entries,
                        ]
                        return Result.ok(page)
                    }
                    const parsed = CursorSchema.parse(cursor)
                    const { page } = parsed
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
                    return Result.ok(
                        pastPage(withCarry(past, parsed), page, parsed, today)
                    )
                } catch (cause) {
                    return Result.err(failed(cause))
                }
            },
        }
    }, [
        revision,
        subject,
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
