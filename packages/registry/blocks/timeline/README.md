# Timeline

A read-only timeline. Pass it an array of entries and it lays them out by day in the system calendar, with a "Now" marker, an "Overdue" group and future entries above now. It never fetches: the DHIS2 layer gives you ordinary TanStack Query hooks that return entries, and you can filter, merge or replace that array however you like before it reaches the timeline.

The block ships as two registry items: `timeline` (the generic layout, in `components/timeline/`) and `timeline-dhis2` (tracker hooks and entry parts for DHIS2 2.41, 2.42 and 2.43, in `components/timeline-dhis2/`).

```sh
pnpm dlx shadcn@latest add devotta-labs/dhis2-blocks/timeline
pnpm dlx shadcn@latest add devotta-labs/dhis2-blocks/timeline-dhis2
```

## A person's history

One tracked entity across every program they're enrolled in: events, enrollment milestones and notes, and attribute changes, all in one feed. A scheduled event sits in the future, past-due events sit in "Overdue", and the rest are grouped by day. Every entry carries its `kind`, its program and its names, so `Dhis2Entry` can render any of them.

```tsx
import { useConfig } from '@dhis2/app-runtime'
import React from 'react'
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

// A host action: it reads the event the surrounding entry shows.
const OpenInCapture = () => {
    const { baseUrl } = useConfig()
    const { event, orgUnit } = useTimelineEventEntry().data.event
    const params = new URLSearchParams({ eventId: event })
    if (orgUnit !== undefined) {
        params.set('orgUnitId', orgUnit)
    }
    return (
        <a
            href={`${baseUrl}/dhis-web-capture/index.html#/enrollmentEventEdit?${params.toString()}`}
        >
            Open in Capture
        </a>
    )
}

export const PatientHistory = ({
    trackedEntity,
}: {
    trackedEntity: string
}) => {
    const calendar = useSystemCalendar()
    const history = useTrackedEntityHistory({
        trackedEntity,
        timeField: 'occurredAt',
    })
    const { entries, hasMore, showMore } = useShowMore(history.entries)
    return (
        <Timeline<Dhis2EntryData>
            entries={entries}
            status={history.status}
            calendar={calendar}
        >
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
```

To limit it to some programs, pass `programs: ['IpHINAT79UW', 'ur1Edk5Oe2n']`. Without it, the history covers every program in the tracked entity's enrollments.

### What the hooks fetch

| Hook                        | Requests                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------- |
| `useEventEntries`           | `tracker/events` once per program (2.43 requires `program`), every status, `cap + 1` rows   |
| `useEnrollmentEntries`      | `tracker/trackedEntities/{uid}` once, with every enrollment and its notes                   |
| `useAttributeChangeEntries` | `tracker/trackedEntities/{uid}/changeLogs` once per program, 100 rows a page, up to 500     |
| all three                   | `programs/{id}` once per program (cached for the session), and one `organisationUnits` call |

`useTrackedEntityHistory` is those three hooks put together with `mergeHistory`. Compose them yourself to leave a kind out:

```ts
const events = useEventEntries({ trackedEntity, timeField: 'occurredAt' })
const enrollments = useEnrollmentEntries({ trackedEntity })
const history = mergeHistory<Dhis2EntryData>(events, enrollments)
```

Every hook returns `{ entries, status, notices, isFetching, refetch }`. `status` stays `pending` until every request has answered once, so entries never jump around on the first load. After that it never goes back: a retry, a refetch or a newly enrolled program fills in while what is on screen stays. A part that fails becomes a notice with a Retry, and the rest of the history still shows. `status` is `error` only when everything failed.

### Choosing what matters

The timeline shows what you pass it. To hide attribute changes, or anything else, filter the array:

```ts
const clinical = useMemo(
    () => history.entries.filter((entry) => entry.data.kind !== 'change'),
    [history.entries]
)
```

## Entry parts

The entry parts are presentational: they render from the entry and the meta context (calendar, locale, today). `TimelineFeed` wraps each entry in a `TimelineItem`, so the parts render no list item of their own. They work in a dialog or a card too, under a `TimelineMetaProvider`:

```tsx
<TimelineMetaProvider calendar={calendar} locale={locale}>
    <TimelineEventEntry entry={entry} />
</TimelineMetaProvider>
```

`Dhis2Entry` picks the part for each `kind`. It is short, so copy it when you want a kind to look different. `isEntryOf(entry, 'event')` narrows an entry for you.

`TimelineEventEntry` is compound. Leave its children out to get the standard composition, or compose your own from `TimelineEventStage`, `TimelineEventProgram`, `TimelineEventStatus`, `TimelineEventOrgUnit`, `TimelineEventCompletedBy`, `TimelineEventValues`, `TimelineEventNotes` and `TimelineEventChanges`. Your own components can read the event with `useTimelineEventEntry()`. `TimelineChangeEntry` is compound in the same way (`TimelineChangeSummary`, `TimelineChangeList`, `useTimelineSave()`). Every part takes `className` and native props.

**Parts don't fetch.** The one exception is `TimelineEventChanges` ("Show changes"), which fetches that event's changelog only when the user opens it. If you fetch changes some other way, render `TimelineSaves` with the saves.

## Data the host already has

The generic item is just layout. Any array of `TimelineEntry` works:

```tsx
import React from 'react'
import {
    Timeline,
    TimelineFeed,
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
        data: { clinic: 'Ngelehun CHC', reason: 'Antenatal care' },
    },
    {
        id: 'visit-2',
        at: '2026-09-14', // a date with no time sits on its day
        precision: 'day',
        data: { clinic: 'Ngelehun CHC', reason: 'Follow-up' },
    },
]

export const VisitHistory = () => (
    <Timeline<Visit> entries={visits} calendar="iso8601" locale="en">
        <TimelineFeed<Visit>>
            {(entry) => (
                <>
                    <strong>{entry.data.reason}</strong> at {entry.data.clinic}{' '}
                    <TimelineTime entry={entry} />
                </>
            )}
        </TimelineFeed>
    </Timeline>
)
```

To merge it with a DHIS2 history, concatenate the arrays. Keep ids unique across them, for example by prefixing your own (`referral:42`).

## A headless layout

Skip `TimelineFeed` and lay the groups out yourself with `useTimeline()`, which returns `{ state, meta }` (entries, groups and status; calendar, locale, today and the timeline's id), or call `groupTimeline(entries, options)` without any React at all.

```tsx
import React from 'react'
import { useTimeline } from '@/components/timeline'

const GroupedList = () => {
    const { groups } = useTimeline<string>().state
    return groups.map((group) => (
        <section key={`${group.phase}:${group.key}`}>
            <h3>
                {group.label} ({group.entries.length})
            </h3>
            <ul>
                {group.entries.map((entry) => (
                    <li key={entry.id}>{entry.data}</li>
                ))}
            </ul>
        </section>
    ))
}
```

## Server paging

One source that pages on the server needs nothing special. Use `useInfiniteQuery`, flatten the pages into entries, and point `TimelineShowMore` at the next page. The "Events updated today" demo (`apps/web/src/app/TimelineDemo/UpdatedTodayDemo.tsx`) does exactly this, using `useProgramInfo`, `useOrgUnitNames` and `eventEntry` to name the events:

```tsx
<TimelineShowMore
    hasMore={pages.hasNextPage}
    loading={pages.isFetchingNextPage}
    onShowMore={() => void pages.fetchNextPage()}
/>
```

Merging several sources that each page on the server is not built in. The history hooks fetch each person's data in full, up to a cap, instead.

## Notes

**`timeField` has no default.** `useEventEntries` and `useTrackedEntityHistory` need `timeField` (`occurredAt`, `scheduledAt`, `completedAt`, `createdAt` or `updatedAt`): the field that orders and places events. Programs differ in which date they treat as the visit date, and a wrong default would reorder their history without any error, so you choose. Scheduled, overdue and skipped events always sit at their `scheduledAt`.

**The cap.** Each program's events are read in one request of up to `cap` (default 500). When there are more, a notice says "Showing the most recent 500 events in {{program}}." Scheduled events that have no `occurredAt` sort first on `occurredAt:desc`, so a capped history still keeps the upcoming visits.

**Changes.** Attribute changes and each event's "Show changes" read the tracker changelog endpoints, with no version gate. Where an endpoint answers 404, a notice says changes "aren't available on this DHIS2 version" instead of showing an empty history. The server only records changes when it is set up to: on 2.43 the program and the tracked entity type need `enableChangeLog: true`, and on 2.41 the tracked entity type needs `allowAuditLog: true`. Without that setting, changes are simply absent. The block can't tell that apart from "nothing changed", so check the setting if your users rely on it.

**A record with no enrollments** shows no attribute changes. The changelog is asked for per program, and labels come from program metadata, so with no program there is nothing to ask for. Pass `programs` to choose which programs' changes appear.

**Notes live in two places, on purpose.** Enrollment notes are entries in the feed. Event notes stay with their event (`TimelineEventNotes`), because they belong to the visit.

**Dates in other calendars.** Day headings and dates follow the system calendar. Gregorian and ISO 8601 read as "Oct 14, 2026" in the user's locale. Ethiopian, Coptic, Nepali, Islamic, Persian and Thai have no month names in `Intl`, so they show as `YYYY-MM-DD` in that calendar. `Timeline` needs `calendar` even for data that isn't from DHIS2: use `'iso8601'`.

**Refreshing.** The hooks are plain TanStack Query hooks, so your `QueryClient` defaults apply. After your app edits data elsewhere, call `refetch()` or invalidate every timeline query:

```ts
import { timelineKeys } from '@/components/timeline-dhis2'

queryClient.invalidateQueries({ queryKey: timelineKeys.root })
```

Entries already on screen stay there until the new answers replace them.

**Known gap.** DHIS2 leaves out events the user can't read, without saying so. A history can be missing events, and there's no way to detect it.
