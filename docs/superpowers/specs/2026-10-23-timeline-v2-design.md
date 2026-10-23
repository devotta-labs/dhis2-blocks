# Timeline v2: plain data in, plain hooks at the edges

Status: draft, 2026-10-23. Replaces the v1 design (`2026-10-22-timeline-design.md`, on `jc/feat/timeline`). Built on
`jc/feat/timeline-v2`, then ported onto master's single registry package: the blocks live in
`packages/registry/blocks/{timeline,timeline-dhis2,dhis2-value-display}`.

## Why a v2

v1 does the job, but it locks the host into its way of working (see the critique of `f87b787`):

1. All data has to come in as a pager (`TimelineSource.fetchPage` with `revision`, `subject` and `completeUntil`).
2. TanStack Query is bent out of shape (`staleTime: Infinity`, `useQueryRevision`), so `refetch`/`isFetching` don't
   behave the way they do everywhere else in the host app.
3. A private external store means that filtering entries requires rebuilding `Timeline` from its internals.
4. Entry parts only work inside the feed. `TimelineDhis2Provider` reads the feed's own state to find org units.
5. Rendering is keyed on `sourceKey` strings, and `'events'` is hard-coded. Two events sources collide, and every host
   writes four type guards.
6. The program is the unit. A patient's record spans programs (ANC, EPI, TB/HIV), and v1 can't show that.

v1's first goal ("merging paged sources correctly") solved a problem the main use case doesn't have: one person's
history is bounded. v2 drops cross-source paging and keeps everything else that made v1 useful.

## Use case

**A patient's history across programs**, for a lightweight EMR or case dashboard. It shows one tracked entity, every
program they're enrolled in (or a chosen subset), and their events, enrollment milestones, enrollment notes and
attribute changes, all in one feed.

A second route, "Events updated today in my org unit", still checks that the layering is general. It is now a single
server-paged source, built by the host with `useInfiniteQuery`.

## Goals

- **`Timeline` takes `entries`**, a plain array. Grouping, "now", overdue and the future/past split are pure functions
  that the host can call or replace.
- **Entries describe themselves.** The DHIS2 entry data is a discriminated union on `kind` (`'event' | 'milestone' |
'note' | 'change'`). Each entry carries its program and the names already resolved: program, stage, org unit,
  data element and attribute labels with value metadata.
- **Parts are presentational.** They render from the entry plus a small meta context (calendar, locale, today), so
  they work inside a `Timeline` or anywhere under a `TimelineMetaProvider`: a dialog, a card or a list.
- **DHIS2 hooks are ordinary TanStack Query hooks.** They are scoped to the patient (`programs?: string[]`) and return
  `{ entries, status, notices, isFetching, refetch }`. Refresh, caching and `isFetching` behave like any other query.
- **A shipped default dispatcher**, `TimelineHistoryEntry`, that hosts can use as is or copy and edit.
- **Consistent part contracts, as in the sidebar block.** `TimelineFeed` wraps each entry in `TimelineItem`. No entry
  part renders its own list item. Every part takes `className` and native props (`ComponentPropsWithoutRef`: the parts
  don't forward refs, so they don't accept one), spreads them first and then sets the attributes it relies on, and
  carries a `data-slot` named `timeline-*`.
- **A smaller install.** No paging engine, no custom store, no `useQueryRevision`, no `better-result` in the
  generic layer.

## Keep from v1

- The neutral `TimelineEntry` shape (`id`, `at`, `precision`, `sequence`, `phase`, `data`). `sourceKey` is dropped.
- Day grouping in the system calendar, the "Now" marker, the overdue group and future entries above now.
- DHIS2 event placement: derived status, `scheduledAt` for scheduled/overdue/skipped events, and a `timeField` that
  must be passed explicitly.
- Value formatting from metadata via `dhis2-value-display`, plus `displayInReports` key values with a cap of 5.
- Separate notices for unsupported, failed and capped data.
- An accessible feed: a section per group with a heading, and focus that moves to the first new entry on "Show more".
- Compound event parts with host slots (`useTimelineEventEntry`, e.g. `OpenInCapture`).
- The fixtures for 2.41, 2.42 and 2.43, and the e2e record.

## Non-goals

- Server paging across several sources. If a real host needs it, a pure merge helper can be added later. A single
  server-paged source needs nothing special (see the updated-today route).
- Deciding what counts as "important". Hosts filter the array (`entries.filter(...)`). The demo shows a kind filter.
- Event programs without registration as a shipped source.
- Virtualisation.
- Detecting whether change logging is enabled on the server (see Decision 7).

## Anti-goals

- **Parts that fetch on their own initiative.** A part never fetches to render. The one exception is a disclosure
  that the user opens (`TimelineEventChanges`, "Show changes"). Its fetch is lazy, bounded by clicks, and it has a
  presentational twin (`TimelineSaves`) for hosts that fetch some other way. Observation Cards follows the same rule.
- **A protocol the host must implement.** The input is an array.
- **Hidden query options.** The hooks pass nothing unusual to TanStack Query except long `staleTime` on metadata,
  which doesn't change during a session.

## Verified API facts (play.im.dhis2.org, 2026-10-23)

Checked on **2.41.10** and **2.43.2** with `PQfMcpmXeFE`, a person enrolled in Child Programme (`IpHINAT79UW`) and
TB program (`ur1Edk5Oe2n`):

| Request                                                      | 2.41.10                                                                         | 2.43.2                                                  |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `tracker/trackedEntities/{uid}` without `program`            | enrollments in every program                                                    | enrollments in every program                            |
| `tracker/trackedEntities/{uid}?program=P`                    | only P's enrollment                                                             | only P's enrollment                                     |
| `tracker/events?trackedEntity=` without `program`            | 200, the person's events                                                        | **400: "Required parameter 'program' is not present."** |
| `tracker/trackedEntities/{uid}/changeLogs` without `program` | 4 rows (type attributes only)                                                   | 4 rows                                                  |
| the same with `program=IpHINAT79UW` / `ur1Edk5Oe2n`          | 6 / 12 rows                                                                     | 6 / 12 rows                                             |
| `tracker/events?program&pageSize=501`                        | 501 rows; scheduled events with no `occurredAt` come first on `occurredAt:desc` | same                                                    |

These facts set the request plan:

- **Programs** come from `options.programs`, or else from the enrollments returned by one tracked entity request
  without `program`.
- **Events**: one request per program (`useQueries`), all statuses, `order=<timeField>:desc,event:asc`,
  `pageSize=cap+1`.
- **Attribute changes**: one request per program, read 100 rows a page up to `maxRows` (500), and de-duplicated on
  `createdAt + username + field`, because the type's attributes repeat in every program's answer.
- **Metadata**: one `programs/{id}` request per program. **Org unit names**: one batched request for every org unit
  on the person's events and in their org-unit-typed values.

With N programs that is 3N + 2 requests (more when a changelog runs past one page), and the count grows with every
program the person is enrolled in. Pass `programs` to limit it.

## Shapes

### Generic layer (`timeline`)

```ts
interface TimelineEntry<TData = unknown> {
    id: string
    at: string                 // stored date or date-time, as the server wrote it
    precision?: 'instant' | 'day'
    sequence?: number          // tiebreak within an instant
    phase?: 'future' | 'overdue' | 'past'
    data: TData
}

type TimelineStatus = 'pending' | 'error' | 'success'

interface TimelineNotice {
    id: string
    tone: 'info' | 'warning' | 'error'
    message: string
    retry?: () => void
}

// Pure
groupTimeline(entries, { order, groupBy, today, calendar, locale, labels }): { groups, nowIndex }
compareEntries(order): (a, b) => number
revealPast(entries, { count, today }): { entries, hidden }   // all future/overdue + the newest `count` past

// React
<Timeline entries status? order? groupBy? calendar locale? now? className? ...div props>
<TimelineMetaProvider calendar locale? now?>              // for parts rendered outside a Timeline
useTimeline(): { state: { entries, groups, nowIndex, status }, meta: { id, order, calendar, locale, today } }
useTimelineMeta(): { order, calendar, locale, today }
useShowMore(entries, { step = 50, now? }): { entries, hasMore, showMore }

// Parts (all take className and native props)
TimelineFeed({ children: (entry) => ReactNode })        // wraps each entry in TimelineItem
TimelineItem, TimelineMarker, TimelineConnector, TimelineGroupHeading, TimelineNow, TimelineTime
TimelineLoading                                         // when status is 'pending'
TimelineEmpty                                           // when status is 'success' and entries are empty
TimelineError({ onRetry? })                             // when status is 'error'
TimelineNotices({ notices })
TimelineShowMore({ hasMore, onShowMore, loading? })     // focuses the first new entry
```

The context is a plain React context shaped `{ state, meta }`, as the composition guide's context interface and
`useSidebar` are; it has no `actions`, since the timeline never changes its own entries. `Timeline` memoises the layout
from `entries` and passes it down. There is no store and no subscription. `status` is a prop because the generic layer has no idea where the data comes from.

### DHIS2 layer (`timeline-dhis2`)

```ts
type HistoryEntryData =
    EventEntryData | MilestoneEntryData | NoteEntryData | ChangeEntryData

interface ProgramInfo {
    id: string
    name: string
    stages: ReadonlyMap<string, StageInfo>
    attributes: ReadonlyMap<string, FieldInfo>
}
interface StageInfo {
    id: string
    name: string
    hideDueDate: boolean
    reportDataElementIds: string[]
    dataElements: ReadonlyMap<string, FieldInfo>
}
interface FieldInfo {
    name: string
    meta: ValueMeta
}

interface EventEntryData {
    kind: 'event'
    event: TrackerEvent
    status: DerivedEventStatus
    program?: ProgramInfo // undefined when its metadata could not be read
    stage?: StageInfo
    orgUnitName?: string
    orgUnitNames: ReadonlyMap<string, string> // for org-unit-typed values; shared by every entry
}
interface MilestoneEntryData {
    kind: 'milestone'
    milestone: 'enrolled' | 'incident' | 'completed' | 'cancelled'
    enrollment: Enrollment
    program?: ProgramInfo
}
interface NoteEntryData {
    kind: 'note'
    note: Note
    enrollment: Enrollment
    program?: ProgramInfo
}
interface ChangeEntryData {
    kind: 'change'
    save: ChangeSave
}

interface ChangeSave {
    // one user's save: same createdAt, same user
    id: string
    createdAt: string
    user: { username: string; displayName: string }
    changes: ResolvedChange[]
}
interface ResolvedChange {
    field: { kind: 'attribute' | 'dataElement' | 'eventField'; id: string }
    name: string // resolved label, or the id
    meta: ValueMeta
    type: 'CREATE' | 'UPDATE' | 'DELETE'
    previousValue?: string
    currentValue?: string
}
```

Entry ids are namespaced by kind and uid (`event:<uid>`, `milestone:<enrollment>:<kind>`, `note:<uid>`,
`change:<createdAt>:<username>`), so two programs can never collide.

Hooks:

```ts
interface HistoryResult<T> {
    entries: TimelineEntry<T>[]
    status: TimelineStatus       // pending until the first answer; error only when everything failed
    notices: TimelineNotice[]    // failed parts (with retry), unsupported changelog, capped events
    isFetching: boolean
    refetch(): void
}

useEventEntries({ trackedEntity, programs?, timeField, cap = 500 }): HistoryResult<EventEntryData>
useEnrollmentEntries({ trackedEntity, programs? }): HistoryResult<MilestoneEntryData | NoteEntryData>
useAttributeChangeEntries({ trackedEntity, programs? }): HistoryResult<ChangeEntryData>
useTrackedEntityHistory({ trackedEntity, programs?, timeField, cap? }): HistoryResult<HistoryEntryData>  // all of the above
useEventChangelog(event, { enabled, stage? }): { status, saves, truncated }
mergeHistory<T>(...results): HistoryResult<T>          // pure: concatenates entries and notices, combines status
addWhenReady<T>(history, ...parts): HistoryResult<T>   // pure: like mergeHistory, but doesn't wait for `parts`
useProgramInfo(programIds), useOrgUnitNames(ids)          // the lookups the hooks share, for hosts naming their own events
```

All of them share one query cache and `timelineKeys`. `queryClient.invalidateQueries({ queryKey: timelineKeys.root })`
still refreshes everything, and so does `refetch()`.

Parts:

```ts
TimelineHistoryEntry({ entry, eventActions? })   // the default dispatcher; copy it to change how a kind renders
TimelineEventEntry({ entry, actions?, children? })  // compound; children default to the standard composition
  TimelineEventProgram, TimelineEventStage, TimelineEventStatus, TimelineEventOrgUnit, TimelineEventCompletedBy,
  TimelineEventValues({ dataElementIds? }), TimelineEventNotes, TimelineEventChanges, useTimelineEventEntry()
TimelineMilestoneEntry({ entry })
TimelineNoteEntry({ entry })
TimelineChangeEntry({ entry, children? })      // compound: TimelineChangeSummary, TimelineChangeList
TimelineSaves({ saves })                       // presentational list of saves (used by TimelineEventChanges)
```

### The case history in a host

```tsx
const history = useTrackedEntityHistory({ trackedEntity, timeField: 'occurredAt' })
const { entries, hasMore, showMore } = useShowMore(history.entries)

<Timeline entries={entries} status={history.status} calendar={calendar} locale={locale}>
    <TimelineLoading />
    <TimelineError onRetry={history.refetch} />
    <TimelineNotices notices={history.notices} />
    <TimelineEmpty />
    <TimelineFeed<HistoryEntryData>>
        {(entry) => <TimelineHistoryEntry entry={entry} eventActions={<OpenInCapture />} />}
    </TimelineFeed>
    <TimelineShowMore hasMore={hasMore} onShowMore={showMore} />
</Timeline>
```

## Decisions

1. **Cap instead of paging.** Each program's events are fetched in one request of `cap + 1` rows (default cap 500).
   Past the cap, a notice reads "Showing the most recent 500 events in {{program}}." "Show more" reveals entries on
   the client (`useShowMore`, 50 at a time), which keeps the DOM bounded. Scheduled events with no `occurredAt` sort
   first on `occurredAt:desc`, so a capped history keeps the upcoming visits.
2. **All statuses in one request.** The v1 split (past stream, plus separate SCHEDULE and SKIPPED requests) existed
   so paging stayed append-only. Without paging, one request per program is enough.
3. **The hook waits for names.** An event entry appears once its events, its program metadata and the org unit names
   have answered, so ids never flash before names. A failed metadata or names request leaves ids in place and adds a
   notice. It doesn't fail the history.
4. **Notes stay where DHIS2 puts them.** Enrollment notes are entries in the feed. Event notes stay inside their event
   (`TimelineEventNotes`). This is deliberate: an event note belongs to the visit.
5. **Status is a prop on `Timeline`.** It is derived by the hook (`mergeHistory`): `pending` while any first load is
   pending and nothing is shown yet, `error` when every part failed, otherwise `success`, with failed parts listed as
   notices that carry `retry`. `useTrackedEntityHistory` waits for events and enrollments together, but not for
   attribute changes (`addWhenReady`): the changelog is read a page at a time per program, is often the slowest
   request, and matters least, so its entries join the history when they arrive. A host that wants every part at once
   composes the hooks with `mergeHistory` alone.
6. **Once shown, a history stays shown.** Each hook latches after its first full answer for a record: a retry of a
   failed part, a refetch or a newly enrolled program never puts it back to `pending`. A query that failed and is
   being retried counts as failed, not pending (TanStack Query resets it to `pending`). New programs, and their
   enrollments, events and changes, appear once their metadata has answered; org unit names keep the previous answer
   while a new set loads. `refetch()` never cancels a request already on its way, since the hooks share queries.
7. **Change logging may be off.** If `enableChangeLog` (2.43) or `allowAuditLog` (2.41) is off, attribute and event
   changes are simply absent. The block says so in the README and doesn't guess. An EMR host that needs it should
   check the server settings, not the timeline.
8. **Entries carry metadata, not only names.** An event entry holds its `ProgramInfo` and `StageInfo` (shared
   references, one per program) and one `orgUnitNames` map shared by every entry, rather than flattened strings.
   `TimelineEventValues({ dataElementIds })` picks any of the stage's data elements, with their labels and value
   types, so the entry needs the stage's metadata, not a fixed `values[]`. Org-unit-typed values need the names map
   for the same reason. The cost is that entries aren't plain JSON and a host building its own event entries uses
   `eventEntry` with `useProgramInfo` and `useOrgUnitNames` instead of filling in strings. Nothing needs entries to be
   serialisable, and `orgUnitName`, the one name every event shows, is resolved onto the entry.
9. **The generic item still needs `calendar`.** Day grouping must follow the system calendar, so `Timeline` keeps a
   required `calendar` and the `dhis2-value-display` dependency, even for static data. `'iso8601'` is the plain
   choice for non-DHIS2 data.

## Testing

- **Pure (node):** `groupTimeline`, `compareEntries`, `revealPast`, `mergeHistory`, the entry builders (events,
  milestones, notes, change saves, resolution with and without metadata), changelog de-duplication across programs,
  and event status derivation. These run against the recorded 2.41–2.43 fixtures.
- **Hooks (browser):** a mocked engine with two programs. One program's events request fails (notice with retry, the
  rest still shown). The changelog 404s (unsupported notice). A slow changelog doesn't hold back events and
  enrollments. A save shared by two programs' changelogs shows once. The cap is exceeded (notice). `refetch` and
  invalidation of `timelineKeys.root` refresh the history.
- **Parts (browser):** each entry part renders outside a `Timeline` under `TimelineMetaProvider`. `TimelineHistoryEntry`
  dispatches every kind. `TimelineShowMore` moves focus to the first new entry. axe passes on the case history.
- **e2e:** the existing record on 2.41, 2.42 and 2.43, with the case history now showing every program.

## Order of work

1. Generic layer: entries in, pure grouping, a plain context, parts with `className`, show-more.
2. DHIS2 data: self-describing entry builders and plain query hooks across programs. Delete `TimelineDhis2Provider`,
   the sources, the merge engine and `useQueryRevision`.
3. DHIS2 parts: content-only entries, `TimelineHistoryEntry`, presentational `TimelineSaves`.
4. Demos, README, registry, e2e.
