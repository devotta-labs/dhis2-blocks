import React from 'react'
import type { TimelineEntry } from '@/components/timeline/core/types'
import type { HistoryEntryData } from '../types'
import { TimelineChangeEntry } from './TimelineChangeEntry'
import { TimelineEventEntry } from './TimelineEventEntry'
import { TimelineMilestoneEntry } from './TimelineMilestoneEntry'
import { TimelineNoteEntry } from './TimelineNoteEntry'

type DataOf<TKind extends HistoryEntryData['kind']> = Extract<
    HistoryEntryData,
    { kind: TKind }
>

/**
 * Narrows a history entry by the kind of its data.
 * @public For hosts writing their own dispatcher.
 */
export const isEntryOf = <TKind extends HistoryEntryData['kind']>(
    entry: TimelineEntry<HistoryEntryData>,
    kind: TKind
): entry is TimelineEntry<DataOf<TKind>> => entry.data.kind === kind

/**
 * The default look of every kind of history entry. Copy it to change how a
 * kind renders; `eventActions` (an "Open" link, say) is added to each event,
 * where it can read the event with `useTimelineEventEntry()`.
 */
export const TimelineHistoryEntry = ({
    entry,
    eventActions,
}: {
    entry: TimelineEntry<HistoryEntryData>
    eventActions?: React.ReactNode
}) => {
    if (isEntryOf(entry, 'event')) {
        return <TimelineEventEntry entry={entry} actions={eventActions} />
    }
    if (isEntryOf(entry, 'milestone')) {
        return <TimelineMilestoneEntry entry={entry} />
    }
    if (isEntryOf(entry, 'note')) {
        return <TimelineNoteEntry entry={entry} />
    }
    if (isEntryOf(entry, 'change')) {
        return <TimelineChangeEntry entry={entry} />
    }
    return null
}
