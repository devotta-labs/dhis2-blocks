import type { ReactNode } from 'react'
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
    useTrackedEntityHistory,
    type EventTimeField,
    type HistoryEntryData,
} from '@/components/timeline/dhis2'

interface Props {
    trackedEntity: string
    programs?: string[]
    timeField: EventTimeField
    step: number
    locale: string
}

/** The block draws on a white page; the lab's canvas follows the docs' theme. */
const Page = ({
    locale,
    children,
}: {
    locale: string
    children: ReactNode
}) => (
    <div
        dir={locale === 'ar' ? 'rtl' : 'ltr'}
        lang={locale}
        className="w-full max-w-2xl rounded-lg bg-white p-4 md:p-6"
    >
        {children}
    </div>
)

/** The README's composition: a person's history, a step of past entries at a time. */
export const TimelineCanvas = ({
    trackedEntity,
    programs,
    timeField,
    step,
    locale,
}: Props) => {
    const calendar = useSystemCalendar()
    const history = useTrackedEntityHistory({
        trackedEntity,
        programs,
        timeField,
    })
    const { entries, hasMore, showMore } = useShowMore(history.entries, {
        step,
    })
    if (history.isPending) {
        return (
            <Page locale={locale}>
                <TimelineLoading />
            </Page>
        )
    }
    if (history.isError) {
        return (
            <Page locale={locale}>
                <TimelineError onRetry={history.refetch} />
            </Page>
        )
    }
    return (
        <Page locale={locale}>
            <Timeline<HistoryEntryData>
                entries={entries}
                calendar={calendar}
                locale={locale}
            >
                <TimelineNotices notices={history.notices} />
                <TimelineEmpty />
                <TimelineFeed<HistoryEntryData>>
                    {(entry) => <TimelineHistoryEntry entry={entry} />}
                </TimelineFeed>
                <TimelineShowMore hasMore={hasMore} onShowMore={showMore} />
                <TimelineEnd
                    hasMore={hasMore}
                    complete={history.notices.length === 0}
                />
            </Timeline>
        </Page>
    )
}
