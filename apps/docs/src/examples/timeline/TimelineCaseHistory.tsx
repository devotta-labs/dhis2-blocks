import { useConfig } from '@dhis2/app-runtime'
import {
    Timeline,
    TimelineEmpty,
    TimelineError,
    TimelineFeed,
    TimelineLoading,
    TimelineNotices,
    TimelineShowMore,
    useShowMore,
} from '@/components/timeline'
import {
    TimelineHistoryEntry,
    useSystemCalendar,
    useTimelineEventEntry,
    useTrackedEntityHistory,
    type HistoryEntryData,
} from '@/components/timeline-dhis2'

/**
 * A tracked entity's history across every program it is enrolled in.
 *
 * `TlE2eTei001` is the water point that `pnpm docs:up` seeds: completed,
 * active, skipped, overdue and upcoming inspections, two enrollments with
 * notes, and attribute changes. Replace it with a tracked entity from your
 * own instance.
 */
const TRACKED_ENTITY = 'TlE2eTei001'

/** A host action: it reads the event the surrounding entry shows. */
const OpenEvent = () => {
    const { baseUrl } = useConfig()
    const { data } = useTimelineEventEntry()
    return (
        <a
            className="text-sm text-dhis2-primary underline-offset-2 hover:underline"
            href={`${baseUrl}/dhis-web-capture/index.html#/enrollmentEventEdit?eventId=${data.event.event}`}
            target="_blank"
            rel="noreferrer"
        >
            Open
        </a>
    )
}

const TimelineCaseHistory = () => {
    const calendar = useSystemCalendar()
    const history = useTrackedEntityHistory({
        trackedEntity: TRACKED_ENTITY,
        timeField: 'occurredAt',
    })
    const { entries, hasMore, showMore } = useShowMore(history.entries, {
        step: 10,
    })

    return (
        <Timeline<HistoryEntryData>
            entries={entries}
            status={history.status}
            calendar={calendar}
            className="p-6"
        >
            <TimelineLoading />
            <TimelineError onRetry={history.refetch} />
            <TimelineNotices notices={history.notices} />
            <TimelineEmpty />
            <TimelineFeed<HistoryEntryData>>
                {(entry) => (
                    <TimelineHistoryEntry
                        entry={entry}
                        eventActions={<OpenEvent />}
                    />
                )}
            </TimelineFeed>
            <TimelineShowMore hasMore={hasMore} onShowMore={showMore} />
        </Timeline>
    )
}

export default TimelineCaseHistory
