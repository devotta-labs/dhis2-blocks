# Timeline

A read-only timeline that merges paged sources into one feed grouped by day, with a "Now" marker, an "Overdue" group, load more and a notice for each source that failed. A `Timeline` provider runs the sources and shares the result; flat parts read it, and you compose the entry for each source.

The block ships as two registry items that install side by side under `components/timeline/`: `timeline` (the generic feed) and `timeline-dhis2` (tracker sources and entry parts for DHIS2 2.41, 2.42 and 2.43).

```sh
pnpm dlx shadcn@latest add devotta-labs/dhis2-blocks/timeline
pnpm dlx shadcn@latest add devotta-labs/dhis2-blocks/timeline-dhis2
```

## Case history

One tracked entity in one program: events, enrollment milestones, notes and attribute changes in a single feed. A scheduled event sits in the future, past-due events in "Overdue", the rest by day. Each source has its own key, so `TimelineFeed` picks the entry part by `sourceKey`. Inside the feed, wrap `TimelineChangeEntry` in `TimelineItem`; the event, note and milestone entries render their own.

```tsx
import {
    Timeline,
    TimelineEmpty,
    TimelineError,
    TimelineFeed,
    TimelineItem,
    TimelineLoadMore,
    TimelineLoading,
    TimelineSourceNotices,
    type TimelineEntry,
} from '@/components/timeline'
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
} from '@/components/timeline/dhis2'

type HistoryData =
    EventEntryData | MilestoneEntryData | NoteEntryData | ChangeGroup

// A host action: it reads the event the surrounding TimelineEventEntry shows.
const OpenInCapture = () => {
    const { data } = useTimelineEventEntry()
    const { event, orgUnit } = data.event
    return (
        <a
            href={`../../dhis-web-capture/index.html#/enrollmentEventEdit?eventId=${event}&orgUnitId=${orgUnit ?? ''}`}
        >
            Open in Capture
        </a>
    )
}

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

const renderEntry = (entry: TimelineEntry<HistoryData>) => {
    if (isEvent(entry)) {
        return (
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
}

export const CaseHistory = ({
    trackedEntity,
    program,
}: {
    trackedEntity: string // placeholder: a tracked entity uid
    program: string // placeholder: a program uid
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
        >
            <TimelineDhis2Provider program={program}>
                <TimelineLoading />
                <TimelineError />
                <TimelineSourceNotices />
                <TimelineEmpty />
                <TimelineFeed<HistoryData>>{renderEntry}</TimelineFeed>
                <TimelineLoadMore />
            </TimelineDhis2Provider>
        </Timeline>
    )
}
```

## Data the host already has

`staticTimelineSource` turns entries you hold in memory into a source, so the feed needs no DHIS2 request. An entry's `at` is the stored date or date-time as written; entries after today fall in the future.

```tsx
import {
    staticTimelineSource,
    Timeline,
    TimelineFeed,
    TimelineItem,
    TimelineTime,
    type TimelineEntry,
} from '@/components/timeline'

interface Visit {
    clinic: string
    reason: string
}

const visits: TimelineEntry<Visit>[] = [
    {
        id: 'visit-1',
        at: '2026-03-02T09:30:00.000', // placeholder data
        sourceKey: 'visits',
        data: { clinic: 'Ngelehun CHC', reason: 'Antenatal care' },
    },
    {
        id: 'visit-2',
        at: '2026-09-14', // a date with no time sits on its day
        precision: 'day',
        sourceKey: 'visits',
        data: { clinic: 'Ngelehun CHC', reason: 'Follow-up' },
    },
]

const sources = [staticTimelineSource('visits', 'Visits', visits)]

export const VisitHistory = () => (
    <Timeline<Visit> sources={sources} calendar="gregorian" locale="en">
        <TimelineFeed<Visit>>
            {(entry) => (
                <TimelineItem entry={entry}>
                    <strong>{entry.data.reason}</strong> at {entry.data.clinic}{' '}
                    <TimelineTime entry={entry} />
                </TimelineItem>
            )}
        </TimelineFeed>
    </Timeline>
)
```

Keep `sources` stable between renders (module level or `useMemo`); a new array of new sources restarts them.

## A headless layout

Skip the feed part and lay the groups out yourself from `useTimelineState`. It takes a selector and re-renders only when the selected value changes.

```tsx
import {
    staticTimelineSource,
    Timeline,
    TimelineLoadMore,
    useTimelineState,
    type TimelineGroup,
} from '@/components/timeline'

interface Reading {
    label: string
}

const GroupedList = () => {
    const groups = useTimelineState<Reading, TimelineGroup<Reading>[]>(
        (state) => state.groups
    )
    const isEmpty = useTimelineState((state) => state.isEmpty)

    if (isEmpty) {
        return <p>Nothing recorded.</p>
    }
    return (
        <>
            {groups.map((group) => (
                <section key={`${group.phase}:${group.key}`}>
                    <h3>
                        {group.label} ({group.entries.length})
                    </h3>
                    <ul>
                        {group.entries.map((entry) => (
                            <li key={entry.id}>{entry.data.label}</li>
                        ))}
                    </ul>
                </section>
            ))}
            <TimelineLoadMore />
        </>
    )
}

const sources = [
    staticTimelineSource<Reading>('readings', 'Readings', [
        {
            id: 'r1',
            at: '2026-10-01T08:00:00.000', // placeholder data
            sourceKey: 'readings',
            data: { label: 'Weight 61 kg' },
        },
    ]),
]

export const ReadingGroups = () => (
    <Timeline<Reading> sources={sources} calendar="gregorian">
        <GroupedList />
    </Timeline>
)
```

## Your own state layer

`Timeline` is `useTimelineSources` plus `buildTimelineState` plus `TimelineProvider`. Use them directly to change how the state is built, for example to hide entries before the parts see them. The parts work unchanged.

```tsx
import React, { useMemo } from 'react'
import {
    buildTimelineState,
    staticTimelineSource,
    TimelineFeed,
    TimelineItem,
    TimelineProvider,
    useTimelineSources,
    type TimelineActions,
    type TimelineMeta,
} from '@/components/timeline'

const sources = [
    staticTimelineSource<string>('notes', 'Notes', [
        {
            id: 'n1',
            at: '2026-10-01T08:00:00.000', // placeholder data
            sourceKey: 'notes',
            data: 'Called the family',
        },
        {
            id: 'n2',
            at: '2026-10-02T08:00:00.000',
            sourceKey: 'notes',
            data: 'Private: do not show',
        },
    ]),
]

export const FilteredTimeline = ({ today }: { today: string }) => {
    const result = useTimelineSources(sources)
    const visible = useMemo(
        () =>
            result.entries.filter((entry) => !entry.data.startsWith('Private')),
        [result.entries]
    )
    const state = useMemo(
        () =>
            buildTimelineState(
                { ...result, entries: visible },
                {
                    order: 'desc',
                    groupBy: 'day',
                    today,
                    calendar: 'gregorian',
                    locale: 'en',
                    labels: {
                        overdue: 'Overdue',
                        undated: 'Undated',
                        allEntries: 'All entries',
                    },
                }
            ),
        [result, visible, today]
    )
    const actions = useMemo<TimelineActions>(
        () => ({ loadMore: result.loadMore, retry: result.retry }),
        [result.loadMore, result.retry]
    )
    const meta = useMemo<TimelineMeta>(
        () => ({ order: 'desc', calendar: 'gregorian', locale: 'en', today }),
        [today]
    )

    return (
        <TimelineProvider state={state} actions={actions} meta={meta}>
            <TimelineFeed<string>>
                {(entry) => (
                    <TimelineItem entry={entry}>{entry.data}</TimelineItem>
                )}
            </TimelineFeed>
        </TimelineProvider>
    )
}
```

## Notes

**`timeField` has no default.** `useTrackedEntityEventsSource` needs `timeField` (`occurredAt`, `scheduledAt`, `completedAt`, `createdAt` or `updatedAt`): the field that orders and places events. Programs differ in which date they treat as the visit date, and a wrong default would reorder their history without any error, so you choose. Scheduled, overdue and skipped events always sit at their `scheduledAt`.

**Changes.** Attribute changes and each event's "Show changes" read the tracker changelog endpoints, with no version gate. They work on any version whose server has those endpoints (2.41.10 and later); where an endpoint answers 404, that source shows a notice ("isn't available on this DHIS2 version") instead of an empty history.

**A SQL view as a source.** Anything that can return a page of `TimelineEntry` is a source. This one reads a SQL view (`placeholderViewUid`, with a `tei` variable) whose rows are `[date, text]`:

```tsx
import { useDataEngine } from '@dhis2/app-runtime'
import { Result } from 'better-result'
import React, { useMemo } from 'react'
import { z } from 'zod'
import {
    Timeline,
    TimelineFeed,
    TimelineItem,
    TimelineSourceNotices,
    type TimelineSource,
} from '@/components/timeline'

const ViewSchema = z.object({
    listGrid: z.object({ rows: z.array(z.tuple([z.string(), z.string()])) }),
})

const useReferralsSource = (trackedEntity: string): TimelineSource<string> => {
    const engine = useDataEngine()
    return useMemo(
        () => ({
            key: 'referrals',
            label: 'Referrals',
            async fetchPage() {
                try {
                    const { view } = await engine.query({
                        view: {
                            resource: 'sqlViews',
                            id: 'placeholderViewUid',
                            params: { var: `tei:${trackedEntity}` },
                        },
                    })
                    const { rows } = ViewSchema.parse(view).listGrid
                    return Result.ok({
                        entries: rows.map(([date, text], index) => ({
                            id: `referrals:${index}`,
                            at: date,
                            sourceKey: 'referrals',
                            data: text,
                        })),
                    })
                } catch (cause) {
                    return Result.err({
                        kind: 'failed' as const,
                        error:
                            cause instanceof Error
                                ? cause
                                : new Error(String(cause)),
                    })
                }
            },
        }),
        [engine, trackedEntity]
    )
}

export const Referrals = ({ trackedEntity }: { trackedEntity: string }) => {
    const source = useReferralsSource(trackedEntity)
    return (
        <Timeline<string> sources={[source]} calendar="gregorian">
            <TimelineSourceNotices />
            <TimelineFeed<string>>
                {(entry) => (
                    <TimelineItem entry={entry}>{entry.data}</TimelineItem>
                )}
            </TimelineFeed>
        </Timeline>
    )
}
```

**Refreshing.** The first page of each DHIS2 source is cached and never refetched on its own. After your app edits data elsewhere, invalidate the timeline's queries and every source starts again:

```ts
import { timelineKeys } from '@/components/timeline/dhis2'

queryClient.invalidateQueries({ queryKey: timelineKeys.root })
```

**Known gap.** DHIS2 leaves out events the user cannot read, without saying so, so a history can be missing events with no way to detect it. Sources that can tell a page was trimmed set `partial`, which shows a notice; the events source cannot.
