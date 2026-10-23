import i18n from '@dhis2/d2-i18n'
import React, { useMemo } from 'react'
import { cn } from '@/registry/dhis2/ui/cn'
import { storedTime } from '@/registry/dhis2/value-display/calendar'
import type { TimelineEntry, TimelineGroup } from '../core/types'
import {
    groupHeadingId,
    useTimelineId,
    useTimelineState,
} from './TimelineContext'

/**
 * The dot that marks an entry on the line.
 * @public Exported for hosts that lay out their own items.
 */
export const TimelineMarker = () => (
    <span
        aria-hidden="true"
        data-slot="timeline-marker"
        className="absolute top-1.5 left-0 size-2.5 rounded-full border-2 border-dhis2-blue-700 bg-white"
    />
)

/**
 * The line that joins an entry to the next one.
 * @public Exported for hosts that lay out their own items.
 */
export const TimelineConnector = () => (
    <span
        aria-hidden="true"
        data-slot="timeline-connector"
        className="absolute top-4 bottom-0 left-[4px] w-px bg-dhis2-border"
    />
)

const positions = new WeakMap<object, Map<unknown, number>>()

/** Where each entry sits in `entries`, found once per array. */
const positionsIn = (entries: TimelineEntry<unknown>[]) => {
    let found = positions.get(entries)
    if (found === undefined) {
        found = new Map(entries.map((entry, index) => [entry, index]))
        positions.set(entries, found)
    }
    return found
}

export interface TimelineItemProps<TData = unknown> {
    entry: TimelineEntry<TData>
    children?: React.ReactNode
}

export const TimelineItem = <TData,>({
    entry,
    children,
}: TimelineItemProps<TData>) => {
    const id = useTimelineId()
    const index = useTimelineState<TData, number | undefined>((state) =>
        positionsIn(state.entries).get(entry)
    )
    return (
        <li
            tabIndex={-1}
            data-timeline-id={id}
            data-timeline-entry-index={index}
            className="relative pb-4 pl-6 outline-none focus-visible:outline-3 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-dhis2-ring"
        >
            <TimelineMarker />
            <TimelineConnector />
            {children}
        </li>
    )
}

export const TimelineGroupHeading = ({
    group,
}: {
    group: TimelineGroup<unknown>
}) => {
    const id = useTimelineId()
    return (
        <h3
            id={groupHeadingId(id, group)}
            className={cn(
                'mb-2 text-sm font-medium text-dhis2-grey-800',
                group.phase === 'overdue' && 'text-dhis2-red-700'
            )}
        >
            {group.label}
        </h3>
    )
}

/** The "now" line between what is coming and what has happened. */
export const TimelineNow = () => (
    <div
        data-slot="timeline-now"
        className="my-2 flex items-center gap-2 text-sm font-medium text-dhis2-blue-800"
    >
        <span aria-hidden="true" className="h-px flex-1 bg-dhis2-blue-300" />
        <span>{i18n.t('Now')}</span>
        <span aria-hidden="true" className="h-px flex-1 bg-dhis2-blue-300" />
    </div>
)

/** The time of day of an entry; nothing for an entry known only by its day. */
export const TimelineTime = ({ entry }: { entry: TimelineEntry<unknown> }) => {
    const time = useMemo(
        () => (entry.precision === 'day' ? undefined : storedTime(entry.at)),
        [entry.precision, entry.at]
    )
    if (time === undefined) {
        return null
    }
    return (
        <time dateTime={entry.at} className="text-sm text-dhis2-grey-700">
            {time}
        </time>
    )
}

/** Shown when every source is done and there is nothing to list. */
export const TimelineEmpty = ({ children }: { children?: React.ReactNode }) => {
    const isEmpty = useTimelineState((state) => state.isEmpty)
    if (!isEmpty) {
        return null
    }
    return (
        <p className="text-sm text-dhis2-grey-700">
            {children ?? i18n.t('No history yet')}
        </p>
    )
}
