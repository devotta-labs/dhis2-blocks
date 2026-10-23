# Tracked Entity Record: design

Date: 2026-10-23 · Status: draft, for review
Working name in the brief: `useEnrollmentDashboard` / enrollment dashboard data layer. Renamed with the user to
**Tracked Entity Record** (`tracked-entity-record`), because it is about one person across programs, not one
enrollment.

## 1. Intent

dhis2-blocks should let a country assemble its own lightweight EMR from blocks. The first screen after picking a
person is a Capture-style person dashboard. Most of what sits on that screen (a banner, notes, a changelog, a
timeline, observation cards) is display, and display alone doesn't make a block: those are recipes. What a builder
working quickly gets wrong is underneath them: which requests to make, what the server silently leaves out, which
enrollment is "the" enrollment, what "overdue" means, which attributes to show, and keeping every view in step after
a write.

This block is that layer. It is **headless**: it loads one tracked entity once, with every enrollment, event and
relationship the user may read and the program metadata needed to make sense of them, and hands it out as plain,
self-describing data. Views read from it and reshape it. Nothing is rendered.

It must not encode opinions about how a country models its data. One program with many stages, or several programs
standing in for stages (because that is easier on someone's analytics), are equally valid. The block never assumes a
dashboard means one program at a time.

## 2. Goals

1. **One load, many views.** A host wraps a screen in `TrackedEntityRecordProvider`; any component under it reads the
   same snapshot of the person.
2. **Any program the person is in, side by side or one at a time.** "Selected program" is the host's state, not the
   block's. The block answers "what is this person's state in program X?" for any X.
3. **Access is honoured, simply.** The person is `ready`, `unavailable` or `error`. Each program is either there with
   read/write flags, or `unavailable`. A locked program never blanks the rest of the record. No break-the-glass, no
   overrides, no prop that loosens anything.
4. **One refresh.** `actions.refresh()` reloads the person after any write made anywhere on the screen.
5. **Small pure helpers for the things that are easy to get wrong**: latest value per data element, overdue status,
   which attributes to show, which enrollment is current, whether a new enrollment is allowed.
6. **Clean seams** for the blocks that come next (§11): stage availability, enrollment-level program rules, lifecycle
   actions, whatever writes events, and the Finder as the way in.

## 3. Non-goals

- Any UI. The demo and docs examples build views as recipes (§13); they are not shipped.
- Writing anything. Writes belong to other blocks (event entry, notes, scheduling, lifecycle); they call `refresh()`.
- Break the glass (`POST /tracker/ownership/override`). If it is ever supported it is a separate, explicit, audited
  flow. This block only reports `unavailable`.
- Telling the user _why_ access is missing (scope vs ownership vs sharing). The server hides most of it from 2.42 on
  (§7), and the user chose to keep it simple: no access is no access.
- Program indicators, program rules evaluation, stage availability rules, lifecycle actions: later blocks (§11).
- Event programs without registration.
- Offline.
- Replacing the Timeline's or Observation Cards' own fetching. They stay usable on their own (§12).

## 4. Anti-goals: failure even if it technically works

- A dashboard that only works one program at a time, or that treats "programs as stages" setups as wrong.
- Showing "not enrolled" for a person who _is_ enrolled but whose enrollment the user may not see. That invites a
  duplicate enrollment. (§7.3)
- Any way for a caller to see more than the server allows: an "include restricted" prop, a fallback request without
  the program, a cached answer from another user.
- A custom store, a pager protocol or bent TanStack Query options (`staleTime: Infinity` on tracker data, a private
  revision counter). `refetch`, `isFetching` and invalidation behave as everywhere else in the host.
- Views fetching on their own to fill gaps in the record. If a view needs more, the record grows a field.

## 5. Constraints and conventions

The block follows **master's architecture**, not older work on feature branches or the Working List's layout
(user's instruction). Event Form is old work: this design neither reuses nor refers to it.

- **Location:** `packages/registry/blocks/tracked-entity-record/`, with a `block.json` (`title`, `description`,
  `docs`). The registry build (`tools/registry/buildRegistry.ts`) picks up every non-test source file. Imports of
  other items use the installed specifiers `@/components/<block>` and `@/components/dhis2/ui/<component>`; inside the
  block imports are relative. Shared `package.json`, `tsconfig.json` and `vitest.config.ts` in `packages/registry/`.
- **Branch:** implementation starts from `origin/master`. It depends on nothing that is only on feature branches
  (Program Rules, Timeline, Observation Cards, Finder). Their seams are described as data shapes (§11).
- **Context shape:** `{ state, actions, meta }`, as in the composition guide (`state-context-interface`) and
  `useSidebar`. The provider is the only place that knows state comes from React Query.
- **Plain TanStack Query:** one keys object with a `root`; ordinary `refetch`, `isFetching` and invalidation; long
  `staleTime` only on metadata, which doesn't change during a session.
- **Pure core, hooks at the edges:** API responses → record is a pure function tested against recorded fixtures. The
  helpers are pure functions over the record.
- **Deep, small interface:** a host learns one provider, one hook, the record's shape and a handful of helpers. The
  request plan, version differences and the 404 handling stay inside.
- Stack as elsewhere in the repo: React 18, TypeScript, `@tanstack/react-query`, `zod` at API boundaries,
  `better-result` inside the client, `@dhis2/app-runtime` data engine, oxlint/oxfmt, knip, vitest (node + browser).
- DHIS2 versions: the e2e matrix (2.41, 2.42, 2.43, dev).

## 6. Public surface

```tsx
<TrackedEntityRecordProvider
    trackedEntityId={id}
    programs={['hivTreatmentUid', 'tbUid']} // optional: the programs this app cares about (§7.2)
>
    <PersonBanner />
    <HivSummary />
</TrackedEntityRecordProvider>
```

```ts
useTrackedEntityRecord(): {
    state: TrackedEntityRecordState
    actions: { refresh(): Promise<void> }
    meta: { trackedEntityId: string; isFetching: boolean }
}

// Pure helpers (§9)
currentEnrollment(program: ProgramRecord, selectedEnrollmentId?: string): Enrollment | undefined
enrollmentAllowance(record: TrackedEntityRecord, program: ProgramRecord): EnrollmentAllowance
eventStatus(event: TrackerEvent, today: string): DerivedEventStatus
isOverdue(event: TrackerEvent, today: string): boolean
latestValues(events: ReadonlyArray<TrackerEvent>, dataElementIds?: ReadonlyArray<string>): Map<string, LatestValue>
displayAttributes(record: TrackedEntityRecord, programId?: string, options?: { onlyDisplayInList?: boolean }): DisplayAttribute[]
todayIso(): string // the user's local date as YYYY-MM-DD

trackedEntityRecordKeys // React Query keys (§10)
```

- `useTrackedEntityRecord` throws outside the provider, like `useSidebar`.
- There is no standalone hook without the provider (my call: one way in keeps the interface small; the provider is
  cheap and can wrap a single component).
- `state` is a discriminated union, so a host can't read data from a record that isn't there:

```ts
type TrackedEntityRecordState =
    | { status: 'pending' }
    | { status: 'unavailable'; debug?: string } // not found or no access: the same to the server (§7.1)
    | { status: 'error'; error: Error; retry(): void } // network, 5xx, unexpected response shape
    | { status: 'ready'; record: TrackedEntityRecord }
```

`debug` carries the server's message (or the block's reason) in English for developers. It is not translated and not
meant for branching UI.

## 7. Access

### 7.1 The person

What the server says (research in the shared notes, `enrollment-dashboard-access-research.md`):

- **2.42 and later:** `GET /tracker/trackedEntities/{uid}` answers a missing person, one outside the user's scope, one
  owned elsewhere in a protected or closed program, a soft-deleted one and (without `program`) one whose type the
  user can't read, all with the same **404** `"TrackedEntity with id X could not be found."`. The server deliberately
  doesn't reveal that the person exists.
- **2.41:** 404 for missing or deleted; 403 with a specific message for access cases (`User has no access to
TrackedEntity:X` without a program).
- If the user can read no tracked entity type at all: 403 `User has no access to any Tracked Entity Type`.

So the block maps:

| Response                                                 | `state.status`                    |
| -------------------------------------------------------- | --------------------------------- |
| 200                                                      | `ready`                           |
| 404, 403 (and 401 / 409 if an older server sends them)   | `unavailable` (`debug` = message) |
| network failure, 5xx, 400, a response the schema rejects | `error`                           |

This is the same thing Capture does: it never says "access denied" for a person; any failure loading the person reads
as "does not exist".

### 7.2 Programs

`record.programs` is a `Map<programId, ProgramRecord>`:

- **Without the `programs` prop:** one entry per program in which the user can see at least one enrollment, plus
  one per program in `programOwners` whose metadata the user can read (each resolved by §7.3, so a protected program
  owned at another clinic shows as `unavailable` instead of vanishing). Programs whose metadata isn't readable are
  left out when not asked for (my call).
- **With it:** exactly the listed programs, in that order, each with its state. Visible enrollments in programs
  that aren't listed are left out (my call: the app said which programs it cares about).

```ts
type ProgramRecord =
    | {
          status: 'enrolled'
          program: ProgramInfo
          enrollments: Enrollment[]
          access: ProgramAccess
      }
    | { status: 'not-enrolled'; program: ProgramInfo; access: ProgramAccess }
    | { status: 'unavailable'; programId: string; debug: string }
    | { status: 'error'; programId: string; error: Error; retry(): void } // its metadata failed to load

interface ProgramAccess {
    canWrite: boolean // program data write ∧ tracked entity type data write ∧ ¬person.inactive
}
```

A program is `unavailable` when any of these hold (each becomes the `debug` sentence):

1. Its metadata isn't returned (doesn't exist, or no metadata read).
2. `access.data.read` is false.
3. It isn't a tracker program, or its tracked entity type differs from the person's.
4. **The user sees no enrollment and the person's owner for it is outside the user's scope** (§7.3).

### 7.3 Owned elsewhere is not "not enrolled"

From 2.42, enrollments the user may not see (no data read, or owner outside the user's scope for the program's access
level) are left out of every list without an error. A person enrolled in a protected program at another clinic just
looks unenrolled. Capture tells these apart with `programOwners` from the person request made without `program`: an
owner row for the program with no visible enrollment means the record exists and the user can't see it.

The block does the same, mirroring Capture's `handleNotFoundError`. For a readable program of the person's type with
no visible enrollment:

1. **No owner row** → `not-enrolled`.
2. **Owner row**: compare the owner org unit's path with the user's scopes (`me?fields=organisationUnits[id],teiSearchOrganisationUnits[id]`;
   the owner's ancestry from `organisationUnits?filter=id:in:[…]&fields=id,path`):
    - OPEN or AUDITED: owner in capture ∪ search scope → `not-enrolled`; else `unavailable`.
    - PROTECTED or CLOSED: owner in capture scope → `not-enrolled`; else `unavailable`.

An owner in scope with nothing visible happens when the person's enrollments were deleted (the owner row stays), so
the person can be enrolled again. Capture's extra PROTECTED branch (owner in search scope → break the glass) is
`unavailable` here: break the glass is out of scope (§3). A superuser sees every enrollment, so they reach this check
only when the person's enrollments in the program were deleted (the owner row stays). The rule then applies to the
superuser's own scopes like anyone's: an owner outside them is `unavailable`, failing closed, even though the person
could be enrolled again.

This is the one access distinction the block keeps, because getting it wrong either creates duplicate enrollments or
locks a person out of a program for good. The scope lookups run only when some program reaches case 2.

The builder verifies on 2.41–2.43 that `programOwners` without `program` lists owners for programs whose enrollments
are hidden from the user. **Default if a version filters them out** (don't stop to ask; report it): a program with
no visible enrollment and no owner row is `not-enrolled` only if its access level is OPEN or AUDITED; PROTECTED and
CLOSED become `unavailable`, which never offers enrollment where one may exist.

### 7.4 Stages

Each `ProgramInfo.stages` lists **only stages the user can data-read**, in `sortOrder`. The server already leaves out
events of unreadable stages. Each stage carries `canWrite` = stage data write ∧ `ProgramAccess.canWrite`. This matches
Capture, which hides unreadable stages and doesn't render "New event" for unwritable ones.

### 7.5 Inactive person

`person.inactive` makes every `canWrite` false, as Capture does ("This … is deactivated"). The record still loads.

## 8. The record

Everything a view needs, with names resolved, so recipes never fetch:

```ts
interface TrackedEntityRecord {
    person: {
        id: string
        trackedEntityType: TrackedEntityTypeInfo // id, name, access, attributes in metadata order (§9.3)
        orgUnit: string // registering org unit
        inactive: boolean
        potentialDuplicate: boolean
        createdAt: string
        updatedAt: string
        attributes: Map<string, string> // attributeId → API value: type attributes and every visible enrollment's program attributes
    }
    programs: Map<string, ProgramRecord>
    relationships: RelationshipsResult // §8.3
}

interface ProgramInfo {
    id: string
    name: string
    accessLevel: 'OPEN' | 'AUDITED' | 'PROTECTED' | 'CLOSED'
    onlyEnrollOnce: boolean
    displayIncidentDate: boolean
    selectEnrollmentDatesInFuture: boolean
    selectIncidentDatesInFuture: boolean
    enrollmentDateLabel?: string
    incidentDateLabel?: string
    featureType?: string
    completeEventsExpiryDays: number
    expiryDays: number
    expiryPeriodType?: string
    owner?: string // owner org unit from programOwners
    attributes: AttributeInfo[] // programTrackedEntityAttributes in sortOrder (§9.3)
    stages: StageInfo[] // readable only (§7.4)
}

interface StageInfo {
    id: string
    name: string
    sortOrder: number
    repeatable: boolean
    autoGenerateEvent: boolean
    openAfterEnrollment: boolean
    generatedByEnrollmentDate: boolean
    reportDateToUse?: string
    minDaysFromStart: number
    standardInterval?: number
    hideDueDate: boolean
    blockEntryForm: boolean
    allowGenerateNextVisit: boolean
    executionDateLabel?: string
    dueDateLabel?: string
    canWrite: boolean
    dataElements: Map<string, FieldInfo> // programStageDataElements; displayInReports flagged
}

interface AttributeInfo extends FieldInfo {
    displayInList: boolean
    mandatory: boolean
    unique: boolean
}

interface FieldInfo {
    id: string
    name: string // displayFormName ?? displayName
    shortName?: string
    valueType: string
    optionSet?: { id: string; options: { code: string; name: string }[] }
    displayInReports?: boolean
}

interface Enrollment {
    id: string
    programId: string
    status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
    orgUnit: string
    enrolledAt: string
    occurredAt?: string
    completedAt?: string
    followUp: boolean
    createdAt: string
    updatedAt: string
    attributes: Map<string, string> // the enrollment's values limited to that program's own attributes, in program metadata order (2.41 returns other programs' attributes here; the block filters them)
    notes: Note[]
    events: TrackerEvent[] // newest first by occurredAt ?? scheduledAt, then createdAt
}
```

`TrackerEvent` keeps the tracker API's own field names and values (`event`, `programStage`, `enrollment`, `status`,
`occurredAt`, `scheduledAt`, `completedAt`, `createdAt`, `updatedAt`, `orgUnit`, `geometry`, `notes`,
`dataValues: Map<dataElementId, string>`), so a Timeline or Observation Cards builder can read it without a mapping
table (my call). Values everywhere are API strings; formatting is the views' job.

### 8.1 Enrollment order and "current"

`enrollments` are newest first by `enrolledAt`. `currentEnrollment(program, selected?)` mirrors Capture's `AUTO`:

1. If `selected` is given and belongs to the program, that one.
2. Else the only enrollment, if there is one.
3. Else the newest ACTIVE one.
4. Else `undefined` (several, none active): the host lets the user choose.

There can be at most one ACTIVE enrollment per program; the server enforces it on write.

### 8.2 Request plan

All reads go through the app-runtime data engine. Fields are deliberate selections, written once as constants.

1. **Person, enrollments, events:** `GET tracker/trackedEntities/{id}` **without** `program`, `fields=` the person's
   fields, `attributes[attribute,value]`, `programOwners[program,orgUnit]` and
   `enrollments[…, attributes[attribute,value], notes[…], events[…, dataValues[dataElement,value], notes[…]]]`.
   One request gives one consistent snapshot, and avoids `tracker/events` needing `program` on 2.43. The server
   applies its own stage and ownership filtering to embedded enrollments and events.
2. **Program metadata:** one `GET programs?filter=id:in:[…]&paging=false&fields=…` for the programs from (1) and the
   `programs` prop, including `access[data[read,write]]`, `trackedEntityType[id]`, `programTrackedEntityAttributes[…]`
   and `programStages[…, access[data[read,write]], programStageDataElements[…]]`.
3. **Tracked entity type:** `GET trackedEntityTypes/{id}?fields=id,displayName,access[data[read,write]],trackedEntityTypeAttributes[…]`.
4. **Relationships:** `GET tracker/relationships?trackedEntity={id}&fields=…`, plus one `relationshipTypes` request
   for the names in the answer.

(2) waits on (1) only when there is no `programs` prop; with the prop it starts at once. (3) and (4) run in parallel
with (2).

5. **Only when §7.3 case 2 occurs:** the user's scopes (`me`) and the owner org units' paths.

**First task for the builder:** confirm on 2.41, 2.42 and 2.43 that (1) returns embedded events for every readable
stage and all statuses, without paging, and record fixtures. **Default if a version caps or drops them** (don't stop
to ask; report it): one `tracker/events?trackedEntity&program&paging=false` per program, joined to enrollments by
`enrollment`. The record mapping is written against the recorded fixtures, so it waits for this check.

### 8.3 Relationships

```ts
type RelationshipsResult =
    | { status: 'pending' }
    | { status: 'error'; error: Error; retry(): void }
    | { status: 'ready'; relationships: Relationship[] }

interface Relationship {
    id: string
    type: {
        id: string
        name: string
        fromToName: string
        toFromName?: string
        bidirectional: boolean
    }
    direction: 'from' | 'to' // which side this person is on
    other: {
        trackedEntity?: string
        enrollment?: string
        event?: string
        attributes?: Map<string, string>
    }
    createdAt: string
}
```

Relationships load separately so a failure there never blocks the record. The server drops relationships whose other
side or type the user can't read; the block shows what it gets.

### 8.4 Loading and errors

- `pending` until (1) and (3) have answered and every program has a state. Metadata requests that fail make only that
  program `error`. A failed (3) is a person-level `error`.
- **Once shown, a record stays shown** (as Timeline v2 decided): a background refetch or a `refresh()` keeps the last
  good record with `meta.isFetching` true. A refetch that answers `unavailable` (for example after a transfer took the
  person out of scope) replaces the record: that is the server's current answer and must win. A refetch that fails
  with a network error keeps the record and reports the error to the caller of `refresh()`.

## 9. Helpers

All pure and exported; each has its own tests. They take the record (or parts of it), so a view that fetched its data
another way can still call them if it has the same shapes.

### 9.1 Latest value per data element

`latestValues(events, dataElementIds?)` → `Map<dataElementId, { value, event }>`:

- Considers events with status ACTIVE or COMPLETED only (scheduled, skipped and overdue events carry no observations).
  This matches Observation Cards.
- Newest first by `occurredAt`, then `createdAt`; the first event with a non-empty value wins.
- The caller chooses the scope by which events it passes: one enrollment's, all of a program's, or one stage's. The
  README says that program rules' `DATAELEMENT_NEWEST_EVENT_PROGRAM` reads the current enrollment's events.

### 9.2 Overdue

`eventStatus(event, today)` → `'active' | 'completed' | 'scheduled' | 'overdue' | 'skipped'`:

- SCHEDULE with a stored due day (`scheduledAt`'s `YYYY-MM-DD`) before `today` → `overdue`. Days compare as stored
  strings, never through `Date`, so time zones can't shift them.
- A stored legacy `OVERDUE` → `overdue`. VISITED and unknown statuses → `active`.
- Same rule as Timeline v2's `deriveEventStatus`. The server never stores overdue.

`today` is a parameter so tests and hosts control it; `todayIso()` gives the local date.

### 9.3 Attributes for display

`displayAttributes(record, programId?, { onlyDisplayInList })` → `{ attribute: AttributeInfo, value?: string }[]`:

- With a program the person is `enrolled` in: the program's `programTrackedEntityAttributes` in `sortOrder`, with
  `displayInList` from that program.
- Otherwise (no program, or not enrolled): the tracked entity type's `trackedEntityTypeAttributes` in order, with
  their own `displayInList`.
- Values from `person.attributes`. An attribute with no value is still listed unless `onlyDisplayInList` filters it.
- Same rule as Capture and the Finder's result rows.

### 9.4 Enrollment allowance

`enrollmentAllowance(record, program)` → `{ allowed: true } | { allowed: false; reason }`, reasons in this order:

1. `'unavailable'`: the program isn't `enrolled` or `not-enrolled`.
2. `'no-write-access'`: `canWrite` is false (includes an inactive person).
3. `'active-enrollment-exists'`: one ACTIVE enrollment already.
4. `'only-enroll-once'`: `onlyEnrollOnce` and any enrollment exists.

The lifecycle block uses it; a recipe can use it to decide whether to show "Enroll".

## 10. Keys and refresh

```ts
const root = ['tracked-entity-record'] as const
trackedEntityRecordKeys = {
    root,
    person: (id) => [...root, 'person', id],
    relationships: (id) => [...root, 'person', id, 'relationships'],
    programs: (sortedIds) => [...root, 'programs', sortedIds],
    trackedEntityType: (id) => [...root, 'tracked-entity-type', id],
    relationshipTypes: (sortedIds) => [
        ...root,
        'relationship-types',
        sortedIds,
    ],
    userScopes: () => [...root, 'user-scopes'],
    orgUnitPaths: (sortedIds) => [...root, 'org-unit-paths', sortedIds],
}
```

- `actions.refresh()` invalidates `person(id)` (person, enrollments, events, relationships) and resolves when the
  refetch settles. Metadata isn't refetched.
- **Refreshing is manual** (user's decision). A host calls `refresh()` after a write, for example once an event
  is saved. The block does not watch other blocks' mutations.
- Tracker queries use TanStack's defaults for `staleTime` (my call: 0, with `refetchOnWindowFocus` left on, so a
  record left open in a tab catches up). Metadata gets a long `staleTime`.

## 11. Seams for the blocks that follow

Described only, so their designs start from what's here. None of them is built in this work.

| Block                       | Reads from the record                                                                                                                                                                                                                           | Notes                                                                                                                                                                                                              |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `useStageAvailability`      | `StageInfo` (`repeatable`, `blockEntryForm`, `autoGenerateEvent`, `openAfterEnrollment`, `canWrite`, …), `ProgramInfo` (`completeEventsExpiryDays`, `expiryDays`, `expiryPeriodType`), the current enrollment's status and its events per stage | Fetches the user's authorities itself (uncomplete-event authority), one cached `me` query (my call: the record stays about the person).                                                                            |
| Enrollment-level rules      | `Enrollment` (dates, status, org unit, `attributes`), its `events` with data values and dates, `person.attributes`                                                                                                                              | Program Rules takes `RuleEnrollmentInput` and `RuleEventInput[]`. The adapter (`toRuleInput(record, enrollmentId)`) belongs to the rules extension, once Program Rules is on master. Org unit codes aren't loaded. |
| Lifecycle actions           | `Enrollment` (`status`, `followUp`, dates), `ProgramInfo` (`accessLevel`, `onlyEnrollOnce`, date settings and labels, `owner`), `ProgramAccess.canWrite`, `enrollmentAllowance`, `actions.refresh()`                                            | Writes are its own; it calls `refresh()` after each.                                                                                                                                                               |
| Anything that writes events | Ids to write against: `programId`, stage id, `enrollmentId` (from `currentEnrollment`), `trackedEntityId`, `orgUnitId` (the enrollment's), `eventId`; the stage's `canWrite`                                                                    | The writer is not designed here. The host calls `refresh()` once the write succeeds.                                                                                                                               |
| Finder                      | Nothing. The Finder's `onSelect(person)` gives `person.trackedEntity`; the host routes to a screen wrapped in `TrackedEntityRecordProvider trackedEntityId={…} programs={[finderProgram]}`                                                      | The demo takes the id from the URL until the Finder lands.                                                                                                                                                         |
| Timeline, Observation Cards | `TrackerEvent`, `Enrollment`, `ProgramInfo`, `StageInfo.dataElements`                                                                                                                                                                           | See §12.                                                                                                                                                                                                           |

## 12. Views that fetch their own data

Timeline v2 and Observation Cards each have their own query hooks today, and the user wants both ways to work: a view
can load on its own, or take its data from this record. So:

- This block doesn't import them, and they don't have to use it.
- The record exposes tracker-shaped events and enrollments and resolved metadata, so an adapter from the record to a
  view's input is small. Adapters are written when those blocks land on master, in those blocks.
- A view on its own keeps its own refresh; under a record, the host's `refresh()` covers the record. Whether to also
  share a key prefix across blocks is an open question the user has taken to the team
  ([Shared or Self-Fetching Views](https://claude.ai/artifact/MjqxitNX9W1ZGPG3KGv2kX)); this design doesn't depend on
  the answer.

## 13. Demo

A route in `apps/web` (`#/tracked-entity-record?trackedEntity=<id>`), proving that one record feeds several different
views. Recipes in the demo, not shipped:

- A person header: `displayAttributes(record, program, { onlyDisplayInList: true })`.
- A program switcher **and** a side-by-side mode showing two programs at once, from the same provider.
- Latest values for a few data elements: `latestValues`.
- Upcoming and overdue visits: `eventStatus`.
- Unavailable programs shown as a plain "You don't have access to this program's records" panel.
- A small write that shows consistency: add an enrollment note (`POST tracker` with the enrollment's new note), then
  `refresh()`, and every view updates. (My call: a note is the smallest real write.)
- A `refresh` button and a visible `isFetching` indicator.

### 13.1 Docs site page

The block gets a page like every block on master: `apps/docs/src/pages/blocks/tracked-entity-record.mdx`, live
examples in `apps/docs/src/examples/tracked-entity-record/`, registered in `examples/registry.ts` and
`navigation.ts`, plus a docs e2e spec in `e2e/specs-docs/`.

- Examples run against the docs backend, the Sierra Leone demo database, with people already in it (for example
  `PQfMcpmXeFE`, enrolled in Child Programme `IpHINAT79UW` and TB program `ur1Edk5Oe2n`), commented as demo ids to
  replace, the same way the Working List examples are.
- Examples (my call on the set): a person header from `displayAttributes`; two programs side by side from one
  provider; latest values plus upcoming/overdue visits; the `unavailable` state, using an id that doesn't exist.
- The docs session is a superuser, so program-level `unavailable` can't be shown live. The page describes it, and
  the `apps/web` e2e covers it with a restricted user.

## 14. Testing

- **Pure (node):** response → record against recorded fixtures for 2.41, 2.42 and 2.43; program states (enrolled,
  not enrolled, owned out of scope per access level, owner in scope with deleted enrollments, no read, wrong type,
  event program, metadata error); stage filtering and `canWrite`;
  inactive person; `currentEnrollment`; `enrollmentAllowance`; `latestValues`; `eventStatus`; `displayAttributes`;
  status mapping of 404 / 403 / 400 / 5xx / schema failure.
- **Provider (browser project):** a fake engine. Pending → ready; 404 → unavailable; network → error with retry;
  `programs` prop ordering; a failed metadata request makes one program `error`; `refresh()` keeps the record shown
  with `isFetching`, then updates; a refresh that answers 404 replaces the record with `unavailable`; relationships
  failing don't block the record; `useTrackedEntityRecord` throws outside the provider.
- **e2e (real DHIS2 matrix):** seeded metadata and users (new `e2e/metadata/tracked-entity-record-*.json`): a person
  in two programs, one `onlyEnrollOnce`, several enrollments in one; a PROTECTED program with the person owned
  outside the test user's capture scope; a person whose only enrollment in a program was deleted; a stage without
  data read for the test user; an inactive person. The demo
  shows each state; the note write refreshes every view; axe passes.
- **Docs e2e:** the docs page renders each example against the docs backend; axe passes.
- **Install check:** `shadcn add` of the item into the consumer fixture typechecks.

## 15. Risks to check first

1. Embedded events in the person request (§8.2) on every supported version.
2. `programOwners` without `program` listing hidden programs, and owner rows surviving a deleted enrollment (§7.3).
3. Whether the person request without `program` returns program attributes on `attributes`, or only on each
   enrollment's `attributes` (decides how `person.attributes` is merged; the record's shape doesn't change).

### Verified API facts

Recorded as the restricted seeded user (`ter_e2e_nurse`, not admin) on 2.41.10, 2.42.6 and 2.43.2, by
`scripts/e2e/record-tracked-entity-record-fixtures.sh`. Fixtures are in
`packages/registry/blocks/tracked-entity-record/__tests__/fixtures/v41|v42|v43/`. The three risks above:

| Finding                                                                                                                                                                                                    | 2.41                                                                     | 2.42                                    | 2.43                                    |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------- | --------------------------------------- |
| 1. Person request without `program` embeds events for every readable stage, all statuses, unpaged (P1's active enrollment: ACTIVE, 2 COMPLETED, 2 SCHEDULE, SKIPPED), none for the stage without data read | Yes                                                                      | Yes                                     | Yes                                     |
| 2a. `programOwners` lists a program whose enrollment is hidden (P1, PROTECTED program owned at another facility)                                                                                           | Yes                                                                      | Yes                                     | Yes                                     |
| 2b. `programOwners` keeps the owner row after the only enrollment is deleted (P3, `enrollments: []`)                                                                                                       | Yes                                                                      | Yes                                     | Yes                                     |
| 3. Top-level `attributes` hold type attributes only; a program attribute (`TrE2eAtt002`) appears only on enrollments                                                                                       | Type only                                                                | Type only                               | Type only                               |
| 3b. What an enrollment's `attributes` hold                                                                                                                                                                 | Program attributes **and** the person's type attributes (all three seen) | Program attributes of that program only | Program attributes of that program only |

Consequences: no fallback is needed for (1) or (2), so the default request plan (§8.2) and the §7.3 owner rule stand
as written, and §7.3's "default if a version filters them out" is not used. For (3),
`person.attributes` is the top-level attributes merged with every visible enrollment's attributes (an enrollment's
value wins on a clash; they cannot differ, as values are stored once per person), which is correct on all three
versions, including 2.41 where enrollments repeat type attributes.

Other facts the mapping depends on, also from the fixtures:

- **Missing person:** 404 `E1005` "TrackedEntity with id X could not be found." on all three versions (`person-missing.status.json`).
- **Order is not stable.** Enrollments, events and `programOwners` come back in a different order on each version. The
  block sorts (§8.1, `Enrollment.events`); it must not rely on API order.
- **An empty data value** is listed as `{ "dataElement": "X" }` with no `value` key. The tracker importer drops a
  `""` it is sent, so the seed writes one with SQL. The schema must make `value` optional, and `latestValues` treats a
  missing value like an empty one.
- **A stage without data read** is still returned by the `programs` request, with `access.data.read: false`, while
  its events are left out of the person. §7.4's filter by `access.data.read` is therefore needed.
- **Unset stage fields are `null`** (`executionDateLabel`, `reportDateToUse`, `standardInterval`, …); unset program
  fields (labels, `featureType`, `expiryPeriodType`) are absent. Both must parse.
- **A relationship carries the other person's attributes** when `attributes[attribute,value]` is requested under
  `from`/`to`.`trackedEntity`, including program attributes, on all three versions. `tracker/relationships` answers
  with the key `relationships`.

## 16. Left to the builder

- File layout inside the block, internal names, the zod schemas.
- Exact `fields` strings, as long as they cover §8 and are written once.
- How the provider combines the queries (`useQuery` / `useQueries`) as long as §8.4 holds.
- `debug` sentences.
- README content beyond what §6–§12 say.
