import React, { type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/components/dhis2/ui/cn'
import type { TimelineEntry } from '../core/types'
import { groupHeadingId, useTimeline } from './TimelineContext'
import {
    TimelineGroupHeading,
    TimelineItem,
    TimelineNow,
} from './TimelineParts'

/**
 * The groups of entries as nested ordered lists, with "now" in its place.
 * Each entry is wrapped in a `TimelineItem`; `children` renders its content.
 */
export const TimelineFeed = <TData,>({
    children,
    className,
    ...props
}: Omit<ComponentPropsWithoutRef<'ol'>, 'children'> & {
    children: (entry: TimelineEntry<TData>) => React.ReactNode
}) => {
    const { state, meta } = useTimeline<TData>()
    const { groups, nowIndex } = state
    if (groups.length === 0) {
        return null
    }
    const now = (
        <li key="now">
            <TimelineNow />
        </li>
    )
    return (
        <ol
            {...props}
            data-slot="timeline-feed"
            className={cn('m-0 list-none p-0', className)}
        >
            {groups.flatMap((group, index) => [
                ...(index === nowIndex ? [now] : []),
                <li key={`${group.phase}:${group.key}`}>
                    <section
                        data-slot="timeline-group"
                        data-phase={group.phase}
                        aria-labelledby={groupHeadingId(meta.id, group)}
                    >
                        <TimelineGroupHeading group={group} />
                        <ol
                            data-slot="timeline-group-entries"
                            className="m-0 list-none p-0"
                        >
                            {group.entries.map((entry) => (
                                <TimelineItem key={entry.id} entry={entry}>
                                    {children(entry)}
                                </TimelineItem>
                            ))}
                        </ol>
                    </section>
                </li>,
            ])}
            {nowIndex >= groups.length ? now : null}
        </ol>
    )
}
