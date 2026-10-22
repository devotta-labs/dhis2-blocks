import { useConfig } from '@dhis2/app-runtime'
import {
    Timeline,
    TimelineFeed,
    TimelineItem,
    TimelineLoadMore,
    TimelineLoading,
    TimelineEmpty,
    TimelineError,
    TimelineSourceNotices,
    type TimelineEntry,
} from '@dhis2-blocks/timeline'
import {
    TimelineChangeEntry,
    TimelineChangeList,
    TimelineChangeSummary,
    TimelineDhis2Provider,
    TimelineEventChanges,
    TimelineEventCompletedBy,
    TimelineEventEntry,
    TimelineEventNotes,
    TimelineEventOrgUnit,
    TimelineEventStage,
    TimelineEventStatus,
    TimelineEventValues,
    TimelineMilestoneEntry,
    TimelineNoteEntry,
    useEnrollmentMilestonesSource,
    useEnrollmentNotesSource,
    useSystemCalendar,
    useTimelineEventEntry,
    useTrackedEntityAttributeChangelogSource,
    useTrackedEntityEventsSource,
    type ChangeGroup,
    type EventEntryData,
    type MilestoneEntryData,
    type NoteEntryData,
} from '@dhis2-blocks/timeline/dhis2'
import React from 'react'
import { useSearchParams } from 'react-router-dom'
import i18n from '../../i18n'
import { ParamsForm } from './ParamsForm'

const DEFAULT_TRACKED_ENTITY = 'TlE2eTei001'
export const DEFAULT_PROGRAM = 'TlE2ePrg001'

type HistoryData =
    | EventEntryData
    | MilestoneEntryData
    | NoteEntryData
    | ChangeGroup

const isEvent = (
    entry: TimelineEntry<HistoryData>
): entry is TimelineEntry<EventEntryData> => entry.sourceKey === 'events'
const isMilestone = (
    entry: TimelineEntry<HistoryData>
): entry is TimelineEntry<MilestoneEntryData> =>
    entry.sourceKey === 'milestones'
const isNote = (
    entry: TimelineEntry<HistoryData>
): entry is TimelineEntry<NoteEntryData> => entry.sourceKey === 'notes'
const isChange = (
    entry: TimelineEntry<HistoryData>
): entry is TimelineEntry<ChangeGroup> => entry.sourceKey === 'changes'

/** A host action built from the entry the surrounding event shows. */
const OpenInCapture = () => {
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

/** How one event looks, shared by the case history and the updated-today feed. */
const EventComposition = ({
    entry,
}: {
    entry: TimelineEntry<EventEntryData>
}) => (
    <TimelineEventEntry entry={entry}>
        <TimelineEventStage />
        <TimelineEventStatus />
        <TimelineEventOrgUnit />
        <TimelineEventCompletedBy />
        <TimelineEventValues />
        <TimelineEventNotes />
        <TimelineEventChanges />
        <OpenInCapture />
    </TimelineEventEntry>
)

/** The state parts and the feed, picking the entry part by `sourceKey`. */
export const HistoryFeed = () => (
    <div className="flex flex-col gap-3">
        <TimelineLoading />
        <TimelineError />
        <TimelineSourceNotices />
        <TimelineEmpty />
        <TimelineFeed<HistoryData>>
            {(entry) => {
                if (isEvent(entry)) {
                    return <EventComposition entry={entry} />
                }
                if (isMilestone(entry)) {
                    return <TimelineMilestoneEntry entry={entry} />
                }
                if (isNote(entry)) {
                    return <TimelineNoteEntry entry={entry} />
                }
                if (isChange(entry)) {
                    return (
                        <TimelineItem entry={entry}>
                            <TimelineChangeEntry group={entry.data}>
                                <TimelineChangeSummary />
                                <TimelineChangeList />
                            </TimelineChangeEntry>
                        </TimelineItem>
                    )
                }
                return null
            }}
        </TimelineFeed>
        <TimelineLoadMore />
    </div>
)

const CaseHistory = ({
    trackedEntity,
    program,
}: {
    trackedEntity: string
    program: string
}) => {
    const calendar = useSystemCalendar()
    const events = useTrackedEntityEventsSource({
        trackedEntity,
        program,
        timeField: 'occurredAt',
    })
    const milestones = useEnrollmentMilestonesSource({ trackedEntity, program })
    const notes = useEnrollmentNotesSource({ trackedEntity, program })
    const changes = useTrackedEntityAttributeChangelogSource({
        trackedEntity,
        program,
    })
    return (
        <Timeline<HistoryData>
            sources={[events, milestones, notes, changes]}
            calendar={calendar}
            locale={i18n.language}
        >
            <TimelineDhis2Provider program={program}>
                <HistoryFeed />
            </TimelineDhis2Provider>
        </Timeline>
    )
}

export const CaseHistoryDemo = () => {
    const [params] = useSearchParams()
    const trackedEntity = params.get('te') ?? DEFAULT_TRACKED_ENTITY
    const program = params.get('program') ?? DEFAULT_PROGRAM
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
                            name: 'program',
                            label: i18n.t('Program ID'),
                            value: program,
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
                key={`${trackedEntity}:${program}`}
                trackedEntity={trackedEntity}
                program={program}
            />
        </main>
    )
}
