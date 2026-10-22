import React from 'react'
import type { TimelineEntry, TimelineGroup } from '../core/types'
import {
    groupHeadingId,
    useTimelineId,
    useTimelineState,
} from './TimelineContext'
import { TimelineGroupHeading, TimelineNow } from './TimelineParts'

/**
 * The groups of entries as nested ordered lists, with "now" in its place.
 * `children` renders one entry, usually a TimelineItem.
 */
export const TimelineFeed = <TData,>({
    children,
}: {
    children: (entry: TimelineEntry<TData>) => React.ReactNode
}) => {
    const id = useTimelineId()
    const groups = useTimelineState<TData, TimelineGroup<TData>[]>(
        (state) => state.groups
    )
    const nowIndex = useTimelineState((state) => state.nowIndex)
    if (groups.length === 0) {
        return null
    }
    const now = (
        <li key="now">
            <TimelineNow />
        </li>
    )
    return (
        <ol className="m-0 list-none p-0">
            {groups.flatMap((group, index) => [
                ...(index === nowIndex ? [now] : []),
                <li key={`${group.phase}:${group.key}`}>
                    <section aria-labelledby={groupHeadingId(id, group)}>
                        <TimelineGroupHeading group={group} />
                        <ol className="m-0 list-none p-0">
                            {group.entries.map((entry) => (
                                <React.Fragment key={entry.id}>
                                    {children(entry)}
                                </React.Fragment>
                            ))}
                        </ol>
                    </section>
                </li>,
            ])}
            {nowIndex >= groups.length ? now : null}
        </ol>
    )
}
