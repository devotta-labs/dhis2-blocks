import i18n from '@dhis2/d2-i18n'
import React, { useMemo, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/components/dhis2/ui/cn'
import { storedTime } from '@/components/dhis2-value-display/calendar'
import type { TimelineEntry, TimelineGroup } from '../core/types'
import {
    groupHeadingId,
    useOptionalTimeline,
    useTimeline,
} from './TimelineContext'

/**
 * The dot that marks an entry on the line.
 * @public Exported for hosts that lay out their own items.
 */
export const TimelineMarker = ({
    className,
    ...props
}: ComponentPropsWithoutRef<'span'>) => (
    <span
        aria-hidden="true"
        {...props}
        data-slot="timeline-marker"
        className={cn(
            'absolute top-1.5 left-0 size-2.5 rounded-full border-2 border-dhis2-blue-700 bg-white',
            className
        )}
    />
)

/**
 * The line that joins an entry to the next one.
 * @public Exported for hosts that lay out their own items.
 */
export const TimelineConnector = ({
    className,
    ...props
}: ComponentPropsWithoutRef<'span'>) => (
    <span
        aria-hidden="true"
        {...props}
        data-slot="timeline-connector"
        className={cn(
            'absolute top-4 bottom-0 left-[4px] w-px bg-dhis2-border',
            className
        )}
    />
)

export interface TimelineItemProps<
    TData = unknown,
> extends ComponentPropsWithoutRef<'li'> {
    entry: TimelineEntry<TData>
}

/**
 * One entry on the line: a focusable list item with its marker and connector.
 * `TimelineFeed` renders one per entry; use it directly in a feed of your own.
 * The attributes "Show more" finds it by can't be overridden.
 */
export const TimelineItem = <TData,>({
    entry,
    className,
    children,
    ...props
}: TimelineItemProps<TData>) => {
    const timeline = useOptionalTimeline()
    return (
        <li
            {...props}
            tabIndex={-1}
            data-slot="timeline-item"
            data-timeline-id={timeline?.meta.id}
            data-timeline-entry={entry.id}
            className={cn(
                'relative pb-4 pl-6 outline-none focus-visible:outline-3 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-dhis2-ring',
                className
            )}
        >
            <TimelineMarker />
            <TimelineConnector />
            {children}
        </li>
    )
}

export const TimelineGroupHeading = ({
    group,
    className,
    ...props
}: Omit<ComponentPropsWithoutRef<'h3'>, 'id'> & {
    group: TimelineGroup<unknown>
}) => {
    const { meta } = useTimeline()
    return (
        <h3
            {...props}
            id={groupHeadingId(meta.id, group)}
            data-slot="timeline-group-heading"
            className={cn(
                'mb-2 text-sm font-medium text-dhis2-grey-800',
                group.phase === 'overdue' && 'text-dhis2-red-700',
                className
            )}
        >
            {group.label}
        </h3>
    )
}

/** The "now" line between what is coming and what has happened. */
export const TimelineNow = ({
    className,
    children,
    ...props
}: ComponentPropsWithoutRef<'div'>) => (
    <div
        {...props}
        data-slot="timeline-now"
        className={cn(
            'my-2 flex items-center gap-2 text-sm font-medium text-dhis2-blue-800',
            className
        )}
    >
        <span aria-hidden="true" className="h-px flex-1 bg-dhis2-blue-300" />
        <span>{children ?? i18n.t('Now')}</span>
        <span aria-hidden="true" className="h-px flex-1 bg-dhis2-blue-300" />
    </div>
)

/** The time of day of an entry; nothing for an entry known only by its day. */
export const TimelineTime = ({
    entry,
    className,
    ...props
}: Omit<ComponentPropsWithoutRef<'time'>, 'dateTime'> & {
    entry: Pick<TimelineEntry<unknown>, 'at' | 'precision'>
}) => {
    const time = useMemo(
        () => (entry.precision === 'day' ? undefined : storedTime(entry.at)),
        [entry.precision, entry.at]
    )
    if (time === undefined) {
        return null
    }
    return (
        <time
            {...props}
            dateTime={entry.at}
            data-slot="timeline-time"
            className={cn('text-sm text-dhis2-grey-700', className)}
        >
            {time}
        </time>
    )
}
