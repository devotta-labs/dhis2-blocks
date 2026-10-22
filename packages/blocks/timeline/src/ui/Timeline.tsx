import i18n from '@dhis2/d2-i18n'
import React, { useMemo } from 'react'
import type { Dhis2Calendar } from '@/registry/dhis2/value-display/calendar'
import type {
    GroupBy,
    TimelineOrder,
    TimelineSource,
} from '../core/types'
import { useTimelineSources } from '../core/useTimelineSources'
import {
    buildTimelineState,
    TimelineProvider,
    type TimelineActions,
    type TimelineMeta,
} from './TimelineContext'

export interface TimelineProps<TData> {
    sources: ReadonlyArray<TimelineSource<TData>>
    order?: TimelineOrder
    /**
     * How entries are grouped. A function is part of what the groups depend
     * on, so memoise it with `useCallback`; a new one each render regroups
     * every render.
     */
    groupBy?: GroupBy<TData>
    calendar: Dhis2Calendar
    locale?: string
    /** The current moment; defaults to the real one. */
    now?: Date
    firstPageTimeoutMs?: number
    children: React.ReactNode
}

const pad = (value: number) => value.toString().padStart(2, '0')

/** The viewer's local day as `YYYY-MM-DD`. */
const localDay = (date: Date) =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

/** Merges the sources and shares the result with the parts inside it. */
export const Timeline = <TData,>({
    sources,
    order = 'desc',
    groupBy = 'day',
    calendar,
    locale,
    now,
    firstPageTimeoutMs,
    children,
}: TimelineProps<TData>) => {
    const result = useTimelineSources(sources, { firstPageTimeoutMs })
    const today = localDay(now ?? new Date())
    const { loadMore, retry } = result
    const state = useMemo(
        () =>
            buildTimelineState(result, {
                order,
                groupBy,
                today,
                calendar,
                locale,
                labels: {
                    overdue: i18n.t('Overdue'),
                    undated: i18n.t('Undated'),
                    allEntries: i18n.t('All entries'),
                },
            }),
        // `result` is a new object every render; its parts are what matter.
        [
            result.entries,
            result.status,
            result.sources,
            result.hasMore,
            result.loadingMore,
            order,
            groupBy,
            today,
            calendar,
            locale,
        ]
    )
    const actions = useMemo<TimelineActions>(
        () => ({ loadMore, retry }),
        [loadMore, retry]
    )
    const meta = useMemo<TimelineMeta>(
        () => ({ order, calendar, locale, today }),
        [order, calendar, locale, today]
    )
    return (
        <TimelineProvider state={state} actions={actions} meta={meta}>
            {children}
        </TimelineProvider>
    )
}
