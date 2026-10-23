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
    Dhis2Entry,
    useSystemCalendar,
    useTimelineEventEntry,
    useTrackedEntityHistory,
    type Dhis2EntryData,
} from '@/components/timeline-dhis2'
import { Checkbox } from '@/components/dhis2/ui/checkbox'
import React, { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import i18n from '../../i18n'
import { ParamsForm } from './ParamsForm'

const DEFAULT_TRACKED_ENTITY = 'TlE2eTei001'

/** A host action built from the entry the surrounding event shows. */
export const OpenInCapture = () => {
    const { baseUrl } = useConfig()
    const { data } = useTimelineEventEntry()
    const { event, orgUnit } = data.event
    const params = new URLSearchParams({ eventId: event })
    if (orgUnit !== undefined) {
        params.set('orgUnitId', orgUnit)
    }
    return (
        <a
            className="text-sm font-medium text-dhis2-primary underline-offset-2 hover:underline"
            href={`${baseUrl}/dhis-web-capture/index.html#/enrollmentEventEdit?${params.toString()}`}
            target="_blank"
            rel="noreferrer"
        >
            {i18n.t('Open in Capture')}
        </a>
    )
}

const CaseHistory = ({
    trackedEntity,
    programs,
}: {
    trackedEntity: string
    programs?: string[]
}) => {
    const calendar = useSystemCalendar()
    const history = useTrackedEntityHistory({
        trackedEntity,
        programs,
        timeField: 'occurredAt',
    })
    // What counts as important is the host's call: here, a filter on kind.
    const [showChanges, setShowChanges] = useState(true)
    const filtered = useMemo(
        () =>
            showChanges
                ? history.entries
                : history.entries.filter(
                      (entry) => entry.data.kind !== 'change'
                  ),
        [history.entries, showChanges]
    )
    const { entries, hasMore, showMore } = useShowMore(filtered)
    return (
        <Timeline<Dhis2EntryData>
            entries={entries}
            status={history.status}
            calendar={calendar}
            locale={i18n.language}
        >
            <label className="flex items-center gap-2 text-sm">
                <Checkbox
                    checked={showChanges}
                    onCheckedChange={(checked) => setShowChanges(checked)}
                />
                {i18n.t('Show attribute changes')}
            </label>
            <TimelineLoading />
            <TimelineError onRetry={history.refetch} />
            <TimelineNotices notices={history.notices} />
            <TimelineEmpty />
            <TimelineFeed<Dhis2EntryData>>
                {(entry) => (
                    <Dhis2Entry
                        entry={entry}
                        eventActions={<OpenInCapture />}
                    />
                )}
            </TimelineFeed>
            <TimelineShowMore hasMore={hasMore} onShowMore={showMore} />
        </Timeline>
    )
}

const programsFrom = (value: string | null) => {
    const ids = (value ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
    return ids.length === 0 ? undefined : ids
}

export const CaseHistoryDemo = () => {
    const [params] = useSearchParams()
    const trackedEntity = params.get('te') ?? DEFAULT_TRACKED_ENTITY
    const programs = programsFrom(params.get('programs'))
    return (
        <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-6">
            <header className="flex flex-col gap-3">
                <h1 className="m-0 text-xl font-medium">
                    {i18n.t('Case history')}
                </h1>
                <ParamsForm
                    submitLabel={i18n.t('Show history')}
                    fields={[
                        {
                            name: 'te',
                            label: i18n.t('Tracked entity ID'),
                            value: trackedEntity,
                        },
                        {
                            name: 'programs',
                            label: i18n.t('Program IDs (optional)'),
                            value: programs?.join(',') ?? '',
                        },
                    ]}
                />
                <a
                    className="text-sm text-dhis2-primary underline-offset-2 hover:underline"
                    href="#/timeline/updated-today"
                >
                    {i18n.t('Events updated today in my org unit')}
                </a>
            </header>
            <CaseHistory
                key={`${trackedEntity}:${programs?.join(',') ?? ''}`}
                trackedEntity={trackedEntity}
                programs={programs}
            />
        </main>
    )
}
