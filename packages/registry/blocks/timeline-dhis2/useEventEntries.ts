import i18n from '@dhis2/d2-i18n'
import { useQueries } from '@tanstack/react-query'
import { useMemo } from 'react'
import { localDay } from '@/components/timeline/core/today'
import type {
    TimelineNotice,
    TimelineStatus,
} from '@/components/timeline/core/types'
import { combineStatus, NO_ENTRIES } from './history'
import { fetchEvents, type EventTimeField } from './queries'
import { timelineKeys } from './timelineKeys'
import { eventEntry, orgUnitIdsOf } from './toEntries'
import type { EventEntryData, HistoryResult } from './types'
import {
    programLabel,
    refetchOf,
    statusOf,
    unwrap,
    useOrgUnitNames,
    useProgramIds,
    useProgramInfo,
    useSettledOnce,
} from './useHistoryQueries'
import { useTimelineClient } from './useTimelineClient'

export interface EventEntriesOptions {
    trackedEntity: string
    /** Defaults to every program the tracked entity is enrolled in. */
    programs?: ReadonlyArray<string>
    /** Where a past event sits: there is no default, since programs differ. */
    timeField: EventTimeField
    /** Most events read per program; past it a notice says so. */
    cap?: number
    /** The current moment; for tests. */
    now?: Date
}

/**
 * The tracked entity's events in each program, every status, with program,
 * stage and org unit names resolved. One events request per program (2.43
 * requires `program`), one metadata request per program, then one request
 * for the org unit names; entries appear once all have answered.
 */
export const useEventEntries = ({
    trackedEntity,
    programs,
    timeField,
    cap = 500,
    now,
}: EventEntriesOptions): HistoryResult<EventEntryData> => {
    const client = useTimelineClient()
    const ids = useProgramIds({ trackedEntity, programs })
    const info = useProgramInfo(ids.ids)
    const events = useQueries({
        queries: (ids.ids ?? []).map((program) => ({
            queryKey: timelineKeys.events(
                trackedEntity,
                program,
                timeField,
                cap
            ),
            queryFn: async ({ signal }: { signal: AbortSignal }) =>
                unwrap(
                    await fetchEvents(
                        client,
                        { trackedEntity, program, timeField, cap },
                        signal
                    )
                ),
        })),
    })
    const eventsSettled = events.every((query) => statusOf(query) !== 'pending')
    const answered = events.map((query) => query.dataUpdatedAt).join()
    // A program shows once its events and its metadata have both answered,
    // so its events never show ids that names are about to replace.
    const waiting = [...info.pendingIds].join()
    const groups = useMemo(
        () =>
            (ids.ids ?? []).flatMap((program, index) => {
                const data = events[index]?.data
                return data === undefined || info.pendingIds.has(program)
                    ? []
                    : [{ program, ...data, info: info.programs.get(program) }]
            }),
        // `answered` and `waiting` change whenever the queries' data does.
        // oxlint-disable-next-line react-hooks/exhaustive-deps
        [ids.ids, answered, waiting, info.programs]
    )
    const subject = [trackedEntity, programs?.join(), timeField, cap].join('|')
    const firstAnswers = ids.ids !== undefined && eventsSettled && !info.pending
    const answeredOnce = useSettledOnce(firstAnswers, subject)
    // Names are asked for once, after the first answers; later sets (a new
    // program, a new org unit) keep the known names on show while they load.
    const orgUnitIds = useMemo(
        () =>
            answeredOnce
                ? orgUnitIdsOf(
                      groups.map(({ events: list, info: program }) => ({
                          events: list,
                          program,
                      }))
                  )
                : undefined,
        [answeredOnce, groups]
    )
    const names = useOrgUnitNames(orgUnitIds)
    const today = localDay(now ?? new Date())

    const entries = useMemo(
        () =>
            groups.flatMap(({ events: list, info: program }) =>
                list.map((event) =>
                    eventEntry(event, {
                        timeField,
                        today,
                        program,
                        orgUnitNames: names.names,
                    })
                )
            ),
        [groups, timeField, today, names.names]
    )

    const eventStatuses = events.map((query) => statusOf(query))
    const firstStatus: TimelineStatus =
        ids.status !== 'success'
            ? ids.status
            : combineStatus([
                  ...eventStatuses,
                  ...(info.pending || names.pending
                      ? ['pending' as const]
                      : []),
              ])
    const shown = useSettledOnce(firstStatus !== 'pending', subject)
    // Once shown, later loading never empties the history again.
    const status: TimelineStatus =
        firstStatus === 'pending' && shown ? 'success' : firstStatus
    const notices: TimelineNotice[] = [
        ...ids.notices,
        ...events.flatMap((query, index): TimelineNotice[] => {
            const program = ids.ids?.[index] ?? ''
            const label = programLabel(info.programs, program)
            if (statusOf(query) === 'error') {
                return [
                    {
                        id: `events-failed:${program}`,
                        tone: 'error',
                        message: i18n.t(
                            "Events in {{program}} couldn't load.",
                            { program: label }
                        ),
                        retry: refetchOf(query),
                    },
                ]
            }
            return query.data?.capped
                ? [
                      {
                          id: `events-capped:${program}`,
                          tone: 'info',
                          message: i18n.t(
                              'Showing the most recent {{count}} events in {{program}}.',
                              { count: cap, program: label }
                          ),
                      },
                  ]
                : []
        }),
        ...info.notices,
        ...names.notices,
    ]

    return {
        entries: status === 'pending' ? NO_ENTRIES : entries,
        status,
        notices,
        isFetching:
            ids.isFetching ||
            info.isFetching ||
            names.isFetching ||
            events.some((query) => query.isFetching),
        refetch: () => {
            ids.refetch()
            for (const query of events) {
                refetchOf(query)()
            }
        },
    }
}
