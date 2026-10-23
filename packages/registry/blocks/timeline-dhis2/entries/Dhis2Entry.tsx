import React from 'react'
import type { TimelineEntry } from '@/components/timeline/core/types'
import type { Dhis2EntryData } from '../types'
import { TimelineChangeEntry } from './TimelineChangeEntry'
import { TimelineEventEntry } from './TimelineEventEntry'
import { TimelineMilestoneEntry } from './TimelineMilestoneEntry'
import { TimelineNoteEntry } from './TimelineNoteEntry'

type DataOf<TKind extends Dhis2EntryData['kind']> = Extract<
    Dhis2EntryData,
    { kind: TKind }
>

/**
 * Narrows a history entry by the kind of its data.
 * @public For hosts writing their own dispatcher.
 */
export const isEntryOf = <TKind extends Dhis2EntryData['kind']>(
    entry: TimelineEntry<Dhis2EntryData>,
    kind: TKind
): entry is TimelineEntry<DataOf<TKind>> => entry.data.kind === kind

/**
 * The default look of every kind of history entry. Copy it to change how a
 * kind renders; `eventActions` (an "Open" link, say) is added to each event,
 * where it can read the event with `useTimelineEventEntry()`.
 */
export const Dhis2Entry = ({
    entry,
    eventActions,
}: {
    entry: TimelineEntry<Dhis2EntryData>
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
