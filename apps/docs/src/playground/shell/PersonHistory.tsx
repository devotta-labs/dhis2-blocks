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
    type HistoryEntryData,
} from '@/components/timeline/dhis2'
import { useMemo } from 'react'
import { LabServerScope } from '../LabServer'
import type { Log } from '../network'
import { generateLabData, LAB_PERSON } from '../timeline/labData'
import { answer, resourcesOf } from '../timeline/labServer'
import { DEFAULT_SETTINGS } from '../timeline/presets'

const SETTINGS = { ...DEFAULT_SETTINGS, programs: 1, step: 5 }

const History = () => {
    const calendar = useSystemCalendar()
    const history = useTrackedEntityHistory({
        trackedEntity: LAB_PERSON,
        timeField: SETTINGS.timeField,
    })
    const { entries, hasMore, showMore } = useShowMore(history.entries, {
        step: SETTINGS.step,
    })
    return (
        <Timeline<HistoryEntryData>
            entries={entries}
            status={history.status}
            calendar={calendar}
            locale="en"
        >
            <TimelineLoading />
            <TimelineError onRetry={history.refetch} />
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
    )
}

/**
 * The Timeline block on the timeline lab's own fake DHIS2. Every row of the
 * working list shows this one person's history: the two labs' data are not joined.
 */
export const PersonHistory = ({ log }: { log: Log }) => {
    const data = useMemo(() => generateLabData(SETTINGS), [])
    const respond = useMemo(() => answer(SETTINGS, data), [data])
    const resources = useMemo(() => resourcesOf(data), [data])
    return (
        <LabServerScope
            network={SETTINGS.network}
            resources={resources}
            respond={respond}
            log={log}
            systemInfo={data.systemInfo}
        >
            <History />
        </LabServerScope>
    )
}
