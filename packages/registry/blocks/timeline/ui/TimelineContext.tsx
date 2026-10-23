import React, { createContext, useContext, useMemo } from 'react'
import type { Dhis2Calendar } from '@/components/dhis2-value-display/calendar'
import { localDay } from '../core/today'
import type {
    TimelineEntry,
    TimelineGroup,
    TimelineOrder,
    TimelineStatus,
} from '../core/types'

export interface TimelineMeta {
    order: TimelineOrder
    calendar: Dhis2Calendar
    locale?: string
    /** The current day as `YYYY-MM-DD`. */
    today: string
}

/**
 * What the surrounding `Timeline` shows.
 * @public For hosts typing their own parts.
 */
export interface TimelineState<TData = unknown> {
    entries: ReadonlyArray<TimelineEntry<TData>>
    groups: TimelineGroup<TData>[]
    /** The now marker sits before `groups[nowIndex]`. */
    nowIndex: number
    status: TimelineStatus
}

/**
 * The timeline's context: its state and its meta. It has no actions: the
 * timeline never changes its own entries; the host does.
 */
export interface TimelineContextValue<TData = unknown> {
    state: TimelineState<TData>
    meta: TimelineMeta & {
        /** Tells this timeline's elements apart from another one on the page. */
        id: string
    }
}

const TimelineMetaContext = createContext<TimelineMeta | null>(null)
const TimelineContext = createContext<TimelineContextValue | null>(null)

/**
 * Calendar, locale and today for the parts inside it. `Timeline` provides it;
 * wrap parts rendered anywhere else (a dialog, a card) in it yourself.
 */
export const TimelineMetaProvider = ({
    calendar,
    locale,
    order = 'desc',
    now,
    children,
}: {
    calendar: Dhis2Calendar
    locale?: string
    order?: TimelineOrder
    /** The current moment; defaults to the real one. */
    now?: Date
    children: React.ReactNode
}) => {
    const today = localDay(now ?? new Date())
    const meta = useMemo<TimelineMeta>(
        () => ({ order, calendar, locale, today }),
        [order, calendar, locale, today]
    )
    return (
        <TimelineMetaContext.Provider value={meta}>
            {children}
        </TimelineMetaContext.Provider>
    )
}

export const useTimelineMeta = (): TimelineMeta => {
    const meta = useContext(TimelineMetaContext)
    if (meta === null) {
        throw new Error(
            'Timeline parts must be used within Timeline or TimelineMetaProvider.'
        )
    }
    return meta
}

export const TimelineContextProvider = TimelineContext.Provider

/** The state and meta of the surrounding `Timeline`. */
export const useTimeline = <
    TData = unknown,
>(): TimelineContextValue<TData> => {
    const value = useContext(TimelineContext)
    if (value === null) {
        throw new Error('useTimeline must be used within Timeline.')
    }
    // SAFETY: Timeline stored a TimelineContextValue<TData'> for the host's
    // own TData'; the host picks the same TData here, as with any typed context.
    return value as TimelineContextValue<TData>
}

/** The surrounding timeline's context, or null outside one. */
export const useOptionalTimeline = (): TimelineContextValue | null =>
    useContext(TimelineContext)

export const groupHeadingId = (id: string, group: TimelineGroup<unknown>) =>
    `${id}-${group.phase}:${group.key}`
