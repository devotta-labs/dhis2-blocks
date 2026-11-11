import { useConfig } from '@dhis2/app-runtime'
import {
    Timeline,
    TimelineEmpty,
    TimelineEnd,
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
    TimelineEventAction,
    useTimelineEventEntry,
    useTrackedEntityHistory,
    type HistoryEntryData,
} from '@/components/timeline/dhis2'

/**
 * A tracked entity's history across every program it is enrolled in.
 *
 * `Y8aEiTpHSSQ` is a person in the WHO RMNCH Tracker in the Sierra Leone
 * demo database. Replace it with a tracked entity from your own instance.
 */
const TRACKED_ENTITY = 'Y8aEiTpHSSQ'

/** A host action: it reads the event the surrounding entry shows. */
const OpenEvent = () => {
    const { baseUrl } = useConfig()
    const { data } = useTimelineEventEntry()
    return (
        <TimelineEventAction
            href={`${baseUrl}/dhis-web-capture/index.html#/enrollmentEventEdit?eventId=${data.event.event}`}
            target="_blank"
            rel="noreferrer"
        >
            Open
        </TimelineEventAction>
    )
}

const CaseHistory = () => {
    const calendar = useSystemCalendar()
    const history = useTrackedEntityHistory({
        trackedEntity: TRACKED_ENTITY,
        timeField: 'occurredAt',
    })
    const { entries, hasMore, showMore } = useShowMore(history.entries, {
        step: 10,
    })

    if (history.isPending) {
        return <TimelineLoading />
    }
    if (history.isError) {
        return <TimelineError onRetry={history.refetch} />
    }
    return (
        <Timeline<HistoryEntryData> entries={entries} calendar={calendar}>
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
            <TimelineEnd
                hasMore={hasMore}
                complete={history.notices.length === 0}
            />
        </Timeline>
    )
}

const TimelineCaseHistory = () => (
    <div className="p-6">
        <CaseHistory />
    </div>
)

export default TimelineCaseHistory
