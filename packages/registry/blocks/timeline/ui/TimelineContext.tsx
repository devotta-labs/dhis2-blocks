import React, { createContext, useContext, useMemo } from 'react'
import type { Dhis2Calendar } from '@/components/dhis2-value-display/calendar'
import { localDay } from '../core/today'
import type {
    TimelineEntry,
    TimelineGroup,
    TimelineHeadingFacts,
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

export const TimelineMetaContext = createContext<TimelineMeta | null>(null)
export const TimelineContext = createContext<TimelineContextValue | null>(null)

const TimelineHeadingContext = createContext<TimelineHeadingFacts | undefined>(
    undefined
)

/** Opt a custom layout into omitting details already represented by its heading. */
export const TimelineHeadingProvider = ({
    heading,
    children,
}: {
    heading?: TimelineHeadingFacts
    children: React.ReactNode
}) => (
    <TimelineHeadingContext.Provider value={heading}>
        {children}
    </TimelineHeadingContext.Provider>
)

export const useTimelineHeading = () => useContext(TimelineHeadingContext)

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

export const TimelineContextProvider = TimelineContext.Provider

// Encoded: a host's group key may hold spaces, which split an id reference.
export const groupHeadingId = (id: string, group: TimelineGroup<unknown>) =>
    `${id}-${group.phase}:${encodeURIComponent(group.key)}`
