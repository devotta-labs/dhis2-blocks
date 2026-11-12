# Timeline

A read-only timeline. Pass it an array of entries and it lays them out by day in the system calendar, with a dated "Today" marker for now, an "Overdue" group and future entries above now. It never fetches: the DHIS2 layer has a TanStack Query hook that returns a person's history as entries, and you can filter, merge or replace that array however you like before it reaches the timeline.

```sh
pnpm dlx shadcn@latest add devotta-labs/dhis2-blocks/timeline
```

One install, two layers:

- `@/components/timeline`: the generic layout (`core/`, `ui/`, `hooks/`). It takes an array and never fetches.
- `@/components/timeline/dhis2`: tracker hooks and entry parts for DHIS2 2.41, 2.42 and 2.43 (`dhis2/hooks/`, `dhis2/entries/`).

The generic layer never imports the DHIS2 one (`layers.test.ts` checks this), so a host with its own data can delete `dhis2/`.

## A person's history

One tracked entity across every program they're enrolled in: events, enrollment milestones and notes, and attribute changes, all in one feed. A scheduled event sits in the future, past-due events sit in "Overdue", and the rest are grouped by day. Every entry carries its `kind`, its program and its names, so `TimelineHistoryEntry` can render any of them.

```tsx
import { useConfig } from '@dhis2/app-runtime'
import React from 'react'
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
    TimelineEventAction,
    TimelineHistoryEntry,
    useSystemCalendar,
    useTimelineEventEntry,
    useTrackedEntityHistory,
    type HistoryEntryData,
} from '@/components/timeline/dhis2'

// A host action: it reads the event the surrounding entry shows.
const OpenInCapture = () => {
    const { baseUrl } = useConfig()
    const { event, orgUnit } = useTimelineEventEntry().data.event
    const params = new URLSearchParams({ eventId: event })
    if (orgUnit !== undefined) {
        params.set('orgUnitId', orgUnit)
    }
    return (
        <TimelineEventAction
            href={`${baseUrl}/dhis-web-capture/index.html#/enrollmentEventEdit?${params.toString()}`}
        >
            Open in Capture
        </TimelineEventAction>
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
                        eventActions={<OpenInCapture />}
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
```

`TimelineLoading` and `TimelineError` render whenever you render them, inside a `Timeline` or not, so the host decides when: branch on `isPending` and `isError` as above. `TimelineEmpty` ("No history yet") sits inside the `Timeline` and shows when it has no entries.

To limit it to some programs, pass `programs: ['IpHINAT79UW', 'ur1Edk5Oe2n']`. Without it, the history covers every program in the tracked entity's enrollments.

### What the hook returns

`useTrackedEntityHistory` returns `{ entries, isPending, isError, notices, isFetching, refetch }`.

- `isPending` is true until the enrollments, every program's events and metadata, and the org unit names have answered once, so entries never jump around on the first load. Attribute changes don't hold the rest back: a changelog is read a page at a time and is often the slowest request, so its entries join the history when they arrive.
- Once the history has shown it never empties again: a retry, a refetch or a newly enrolled program fills in while what is on screen stays. `isFetching` says a request is on its way.
- A request that fails becomes a notice with a Retry, and the rest of the history still shows. `isError` is true only when neither the enrollments nor any program's events could be loaded.

### What it fetches

| Request                                    | How often                                                                |
| ------------------------------------------ | ------------------------------------------------------------------------ |
| `tracker/trackedEntities/{uid}`            | once, with every enrollment and its notes                                |
| `tracker/events`                           | once per program (2.43 requires `program`), every status, `cap + 1` rows |
| `tracker/trackedEntities/{uid}/changeLogs` | once per program, 100 rows a page, up to 500                             |
| `programs/{id}`                            | once per program, cached for the session                                 |
| `organisationUnits`                        | once, for the names of the events' org units                             |

With N programs that is 3N + 2 requests, plus a request for each further changelog page, so the count grows with every program the person is enrolled in. Pass `programs` to keep it down.

The hook is one module (`dhis2/hooks/useTrackedEntityHistory.ts`) that runs the requests, and one pure function (`dhis2/buildHistory.ts`) that decides what shows when. To change what waits for what, edit `buildHistory`; to build entries from requests of your own, use `eventEntry`, `milestoneEntries`, `noteEntries` and `changeEntries`.

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

`TimelineHistoryEntry` picks the part for each `kind`. It is short, so copy it when you want a kind to look different. `isEntryOf(entry, 'event')` narrows an entry for you.

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

Skip `TimelineFeed` and lay the groups out yourself with `useTimeline()`, which returns `{ state, meta }` (entries, groups and where "now" sits; calendar, locale, today and the timeline's id), or call `groupTimeline(entries, options)` without any React at all.

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

One source that pages on the server needs nothing special. Use `useInfiniteQuery`, flatten the pages into entries, and point `TimelineShowMore` at the next page. For tracker events, use `useProgramInfo(program)`, `useOrgUnitNames(ids)` (both plain `useQuery` results) and `eventEntry` to name the events. Pass `loading` while the page is fetched: the button says so, and focus moves to the first entry of the page when it arrives.

```tsx
<TimelineShowMore
    hasMore={pages.hasNextPage}
    loading={pages.isFetchingNextPage}
    onShowMore={() => void pages.fetchNextPage()}
/>
```

Merging several sources that each page on the server is not built in. `useTrackedEntityHistory` fetches each person's data in full, up to a cap, instead.

## Notes

**`timeField` has no default.** `useTrackedEntityHistory` needs `timeField` (`occurredAt`, `scheduledAt`, `completedAt`, `createdAt` or `updatedAt`): the field that orders and places events. Programs differ in which date they treat as the visit date, and a wrong default would reorder their history without any error, so you choose. Scheduled, overdue and skipped events always sit at their `scheduledAt`.

**The cap.** Each program's events are read in one request of up to `cap` (default 500). When there are more, a notice says "Showing the most recent 500 events in {{program}}." Scheduled events that have no `occurredAt` sort first on `occurredAt:desc`, so a capped history still keeps the upcoming visits.

**Changes.** Attribute changes and each event's "Show changes" read the tracker changelog endpoints, with no version gate. Where an endpoint answers 404, a notice says changes "aren't available on this DHIS2 version" instead of showing an empty history. The server only records changes when it is set up to: on 2.43 the program and the tracked entity type need `enableChangeLog: true`, and on 2.41 the tracked entity type needs `allowAuditLog: true`. Without that setting, changes are simply absent. The block can't tell that apart from "nothing changed", so check the setting if your users rely on it.

**A record with no enrollments** shows no attribute changes. The changelog is asked for per program, and labels come from program metadata, so with no program there is nothing to ask for. Pass `programs` to choose which programs' changes appear.

**Notes live in two places, on purpose.** Enrollment notes are entries in the feed. Event notes stay with their event (`TimelineEventNotes`), because they belong to the visit.

**Dates in other calendars.** Day headings and dates follow the system calendar. Gregorian and ISO 8601 read as "Oct 14, 2026" in the user's locale. Ethiopian, Coptic, Nepali, Islamic, Persian and Thai have no month names in `Intl`, so they show as `YYYY-MM-DD` in that calendar. `Timeline` needs `calendar` even for data that isn't from DHIS2: use `'iso8601'`.

**Refreshing.** The hooks are plain TanStack Query hooks, so your `QueryClient` defaults for stale time and refetching apply. Retries are set per request: a server or network failure is retried twice, a client error or a malformed answer is not, and a changelog is never retried, so its notice and Retry show at once. After your app edits data elsewhere, call `refetch()` or invalidate every timeline query:

```ts
import { timelineKeys } from '@/components/timeline/dhis2'

queryClient.invalidateQueries({ queryKey: timelineKeys.root })
```

Entries already on screen stay there until the new answers replace them.

**Known gap.** DHIS2 leaves out events the user can't read, without saying so. A history can be missing events, and there's no way to detect it.
