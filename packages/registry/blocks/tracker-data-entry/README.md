# Tracker Data Entry

Grid data entry for DHIS2 event and tracker programs: one row per event and one column per data element, or one row per person in a register, typed in like a spreadsheet.
Every change is kept on the device before it is sent, so nothing typed is lost to a dropped connection, a reload or
a crash. Program rules run for every row, as Capture runs them. It builds on `spreadsheet` (the grid),
`dhis2-value-types` (what each value type accepts), `dhis2-value-display` (the calendar) and `program-rules`.

```sh
pnpm dlx shadcn@latest add devotta-labs/dhis2-blocks/tracker-data-entry
```

`TrackerDataEntry` needs a React Query `QueryClientProvider` and the DHIS2 app-runtime provider above it, nothing else. Its
text goes through `@dhis2/d2-i18n` as literal `i18n.t` calls, so `d2-app-scripts i18n extract` finds every string once
the block is in your app's `src`.

## Use it

```tsx
import { SpreadsheetGrid } from '@/components/spreadsheet'
import {
    TrackerDataEntry,
    TrackerDataEntrySummary,
    eventSource,
    useTrackerDataEntry,
} from '@/components/tracker-data-entry'

// Made once: a source with new keys loads the form again.
const inpatient = eventSource({
    programId: 'eBAyeGv0exc',
    orgUnitId: 'DiszpKrYNg8',
})

const Status = () => {
    const status = useTrackerDataEntry((view) => view.status)
    return status === 'ready' ? null : (
        <p>
            {status === 'loading' ? 'Loading…' : 'The form could not be loaded'}
        </p>
    )
}

export const InpatientGrid = () => (
    <TrackerDataEntry source={inpatient}>
        <Status />
        <SpreadsheetGrid />
        <TrackerDataEntrySummary />
    </TrackerDataEntry>
)
```

The grid shows nothing until the form has loaded; show what you want with `useTrackerDataEntry((view) => view.status)`, and
why it could not load with `view.error`. Render your own `Cell`s (from `spreadsheet`) only once `status` is `'ready'`: before that there are
no cells to bind them to. Several forms can share a page: each starts its DOM ids with its own prefix.

## API

```ts
TrackerDataEntry({ source, cells?, children }) // loads the form and keeps it; one per form; cells replace controls, as spreadsheet's `overrides` do
TrackerDataEntrySummary({ className? }) // every message as a link to its cell, the count not yet in DHIS2, the download, and discarding what could not be saved
useTrackerDataEntry(select): T // anything else, and the actions; select a value, not a new object
eventSource(options): TrackerDataEntrySource // the events of a program, a stage or one person
trackerKeyOf(row, column): CellKey // the key of the cell a row has for a column: its slot's record (else the row's own id) and its field
```

```ts
interface TrackerDataEntryView {
    status: 'loading' | 'ready' | 'error'
    error?: string // why the form could not be loaded, while status is 'error'
    tables: ReadonlyArray<GridTable<TrackerRow, TrackerColumn>> // the form's tables as the grid shows them, new rows included
    records: ReadonlyMap<string, DataRecord> // what the rows' cells save to, by record id (a row's own id names its record)
    summary: {
        items: SummaryItem[]
        unsent: number
        failed: number
        canComplete: boolean
    }
    sync: 'idle' | 'sending' | 'offline' | 'signIn' | 'retrying'
    addRow(tableId: string): void
    complete(rowId: string): Promise<SaveOutcome[]>
    reopen(rowId: string): Promise<SaveOutcome[]>
    downloadUnsent(): void
    discardFailed(): Promise<void>
    hasMore: boolean // the last page came back full: there may be more
    loadingMore: boolean
    loadMoreError?: string // why the last page could not load, until the next try
    loadMore(): Promise<void> // appends the next page; one at a time
}

interface EventSourceOptions {
    programId: string
    programStageId?: string
    orgUnitId: string
    orgUnitMode?: 'SELECTED' | 'DESCENDANTS' // default SELECTED
    enrollmentId?: string // one person's events, wherever they happened
    newRowStageId?: string // with enrollmentId: "Add event" adds an event of this stage for the person
    pageSize?: number // default 50
    order?: 'occurredAt:asc' | 'occurredAt:desc' // default occurredAt:desc
}
```

The first `pageSize` events load with the form. While a page comes back full, "Show more events" follows the grid: each
press appends the next page in the same order, and says "Events shown: …"; it keeps focus, and says it is busy while the
page loads. No total is asked for, since counting costs DHIS2 a query on large databases, so the button goes only once a
page comes back short (an empty one when the last was exactly full), and focus moves past the grid. A page that cannot
load says why, shows why beside the button (`loadMoreError`) until the next try, and the button stays to try again. A
page's events join the end of their table, except those already shown (a new event saved here, say); a stage the table
has no columns for adds its columns at the end, "not in this stage" for the other rows. Its unsent changes are put back
on its cells, in the state they were left in, and its rows' rules run as they do on load, with their people: loading a
page saves nothing. A source pages with `loadPage(engine, page, signal)`, returning a `FormPage`: its rows per table,
records, values, read-only and reopenable records, names, and `hasMore`.

A source of your own implements `TrackerDataEntrySource`: `key` names its unsent changes on the device, `load` returns the
`LoadedForm` (its tables, values, and what is required or read-only), `save` takes the changes and says what became of
each one, `setStatus` completes and reopens rows, and `restoreRows` resolves to `{ rows, records }`: the new rows found
unsent after a reload, with their records. Without `rules` the form loads no rule engine.

`LoadedForm` also says what the rows' cells save to: `records` by record id (a row's own id names its record),
`fields` (every field a record may hold, shown or not, by id, and every column any page may add; a cell whose column
has no field there throws), `fieldsByForm` (each form's field ids) and `readOnlyRecords` (why a record is read-only, by
record id).

A row's cells save to the record whose id is the row's, unless a column names a `slot` (`TrackerColumn.slot`): the
row's `slots` (`TrackerRow.slots`) map that name to the id of another record in `LoadedForm.records`, so one row can
show cells of several records. A column whose id is not its field's says the field in `fieldId`, and
`trackerKeyOf(row, column)` gives the cell's key either way. `TrackerRow.stage` is the stage's name, shown after the
event date in a grid of several stages.

The host decides where the buttons go. `complete(rowId)` refuses at once, with one `failed` outcome per reason, a row
the form does not have ("This row cannot be completed") or a read-only one (with why it is), when the device is offline
or someone else is signed in, and while the row has an error, an empty required field, or a change DHIS2 refused or
that waits; otherwise it sends the row's unsent changes first (and refuses if sending pauses), then asks DHIS2.
`reopen(rowId)` asks DHIS2 only for a completed row the user may reopen (`F_UNCOMPLETE_EVENT`, write
access to the stage, not expired), whether it was completed when loaded or here, and refuses the same way offline. A saved
status shows in the row's header and locks or unlocks the row where its stage blocks entry once completed.

`tables` gives the rows to lay such buttons out by, and `records` each row's status:

```tsx
import { useCell } from '@/components/spreadsheet'
import {
    useTrackerDataEntry,
    type TrackerRow,
} from '@/components/tracker-data-entry'

// A "Complete" button for each active row, beside the grid, named by the row's event date once it has one.
const CompleteButton = ({ row }: { row: TrackerRow }) => {
    const complete = useTrackerDataEntry((view) => view.complete)
    const status = useTrackerDataEntry(
        (view) => view.records.get(row.id)?.status
    )
    const { value: date } = useCell(`${row.id}.occurredAt`)
    return status === 'ACTIVE' ? (
        <button type="button" onClick={() => void complete(row.id)}>
            Complete {date ?? row.label}
        </button>
    ) : null
}

const CompleteButtons = () => {
    const tables = useTrackerDataEntry((view) => view.tables)
    return tables
        .flatMap(({ rows }) => rows)
        .map((row) => <CompleteButton key={row.id} row={row} />)
}
```

A refusal comes back as `failed` outcomes with their `reason`; the summary lists what stops the row too.

## Registers

A paper register is one person a row. `registerSource(options): TrackerDataEntrySource` loads a program's enrolments at one
org unit, enrolled in a period, oldest first, a page of `pageSize` (default 25) at a time, with their attributes and
events. Each row's cells save to the person, the enrolment and the events the layout's slots pick; the table's
**Add person** and **Show more people** buttons are labelled for people.

```ts
interface RegisterSourceOptions {
    programId: string
    orgUnitId: string // where new people are enrolled
    enrolledFrom: string // the period's first enrolment day, YYYY-MM-DD, included
    enrolledTo: string // and its last, included
    layout: RegisterLayout
    pageSize?: number // default 25
    today?: string // the day expiry is checked against; the device's date by default
}

interface RegisterLayout {
    title?: string
    rowLabel?: FieldRef[] // what names a row; the first two text attributes by default
    columns: LayoutNode[] // in the paper's order
}
type LayoutNode = LayoutColumn | { group: string; children: LayoutNode[] } // a group is a heading over its children
interface LayoutColumn {
    field: FieldRef
    label?: string // the paper's heading; the field's form name by default
}
type FieldRef =
    | { attribute: string }
    | { enrollment: 'enrolledAt' | 'occurredAt' }
    | ({
          stage: string
          occurrence?: number
          where?: Record<string, string>
      } & ({ dataElement: string } | { eventDate: true }))
```

`compileLayout(layout, metadata)` turns a layout into the grid's columns and heading rows, or says what the program
cannot do for it; `registerSource` does this on load and fails the form with those messages. `registerLayoutSchema`
(zod) checks a layout that is stored or written by hand, and refuses a key it does not know. `NewRow`,
`PersonRecord` and `EnrollmentRecord` are the types of what a row is made of.

**Slots.** A column of a stage is in one slot of the person's row: the stage's only event (a non-repeatable stage), the
nth event of a repeatable stage by date (`occurrence`, from 1; `occurredAt`, else `scheduledAt`), or the event whose
data elements hold given values (`where`: data element id to option code or value). A slot has an `occurrence` or a
`where`, not both, and a column of a repeatable stage needs one of them. An event fills at most one slot. A scheduled event fills its slot, and typing its date makes it
happen. A new event in a `where` slot is made with those values, which no column shows. Events that fit no slot, or
several that fit one, are said on the row ("2 more visits of … not in this register").

**New rows.** A new person, an enrolment and an event per slot, with device ids, at `orgUnitId`. The layout must have a
column for each mandatory attribute (those DHIS2 generates are reserved when the row is added) and the enrolment date,
and a repeatable stage's slot needs its date column. The events Capture schedules on enrolment are made too and fill
their slots: one in a slot with a date column stays scheduled, undated, until the clerk types its date; one in a slot
without is dated as Capture dates it. A row that is not typed in saves nothing.

**What saves and what waits.** One import carries the changed people, enrolments and events together. A new person
waits for the mandatory attributes of its type and program, an enrolment for its date and its person, an event for its
date (a single stage's slot with no date column takes the enrolment date), its enrolment, and the required fields of a
stage that checks them on every save; each waiting cell says what it waits for ("Waiting for: Last name"). A refused
person makes its enrolment and events wait for it. DHIS2's refusals (a unique attribute, say) land on the cell. Unsent
changes belong to the program's registers (`register:<programId>`), apart from its event grids' (see Saving), and a
reload puts back a person's unsent events on their row.

**Read-only**, with the reason on each cell: a program or person type the user cannot write, a cancelled enrolment,
and events by the event grid's rules (completed in a stage that blocks entry, expired, skipped). Attribute file and
image cells show their value and are edited in their own form. A register offers no Complete or Reopen per row.

Program rules run for each person row, including attribute and enrolment cells, with the person as typed.

## Program rules

Rules hide fields and options, make fields required, lock the values they assign and put their messages on cells.
Messages without a field show in the row's header, marked as a cell's are, and in the summary; what rules display
(texts and key-value pairs) is the row's notes, behind a marker in its header ("Note", "Notes: 2") that opens them. A row
whose rules fail shows the error in its header and keeps none of their effects.

Opening the grid never changes data. In a row no one has changed, an assigned cell shows the value DHIS2 holds, locked
with "Assigned by rule: …", and a hidden cell shows "Hidden"; the rule's value appears once the row is changed. The
values rules assign, and the clearing of fields they hide, are saved only with a row a person changes or completes, or
that has unsent changes; they are saved with the person's change. A value a page loads, or one put back when a failed
change is discarded, is no change: it does not make the rules save. A cleared cell says "Cleared by rule: …" until it
holds a value again. Nothing is written to a cell a rule hides: text typed into it is not saved, and text it held that
its type refused is dropped. A rule never changes the cell being typed in; it does once the person leaves the cell. A form whose rules are still loading cannot complete
a row; if they cannot be loaded, the summary says so and nothing completes.

On load the rows in view are evaluated first, for about 100 ms, and the rest about 16 ms at a time when the browser is
idle. Once the rules' Web Worker has started, the rest are evaluated there instead, some rows at a time, and the main
thread only applies what they say; a row changed meanwhile is evaluated again on the main thread, and without a worker
every row is. An edit re-runs its row, and every row of that person when other events read the field or the event date changed,
once the browser has shown the edit, so typing never waits for rules; completing a row runs them first.
The `performance` measures `data-entry:rules` (the first slice) and `data-entry:rules-edit` (each edit) time them.

The rule engine is a large chunk, so only a program with rules loads it. The first load asks DHIS2 for one rule's id
beside the form's own query (`RulesTarget.hasRules`), and the engine starts loading, and runs one empty evaluation to
warm up, as soon as the form says there are some, while the rules themselves are still being fetched. The form never
waits for that question: if it fails, or is still out when the form is ready, the form says there are no rules, and
only the head start is lost; the rules load and report their own failures as usual.

## Rows and cells

Cells are typed in and edited as `spreadsheet` describes (its README has the keys, the pop-up editors, the searching
cells and replacing a control). `TrackerDataEntry` takes the same `cells` overrides and hands them to the grid. What is
the tracker's own: in a table with "Add event", Ctrl+Enter (Cmd+Enter) adds a row after saving what was typed. A row is
named by its event date, in the system calendar and date format, once it has one, its stage after it where the grid
shows several; a new row is "New event" until its date is typed. Event files and images come from the event's own
endpoints (`/api/tracker/events/{event}/dataValues/{dataElement}/file` and `/image`), handed to the grid as its
`fileUrl`. A person's file and image cells show their value, with no preview or download, and are edited in their own
form.

### Bulk actions

The grid's row and column actions work as `spreadsheet` describes (its README's "Bulk actions"). In a register they
fill the visit columns only: the person's attributes and both enrolment dates (the enrolment and the incident date) have
no column button, and a row's actions leave them alone. In an event grid every column takes part. An action that would
write to an event DHIS2 does not hold yet (a visit with no event, or an event grid's newly added, unsaved row) creates
that event, so it first asks "Create events?" ("This creates 3 events on this page.", with **Create events** and
**Cancel**), because undo cannot delete an event once it is sent; an event DHIS2 has saved from this page counts as held.
Ctrl+D (Cmd+D) is like typing: it fills any cell that can be edited and never asks.

## Saving

- Every change goes to an IndexedDB outbox on this device, `dhis2-data-entry:<server>:<user id>`, before it is sent,
  once the browser has shown it and together with the values its rules assign, so both are sent in one save; when the
  page is hidden or closed, at once. It opens only for the same user on the same server. Nothing is encrypted.
- Unsent changes belong to the program and the kind of grid, not the grid: the event grids of a program keep one record
  per cell (the newer change wins), and so do its registers, and any open grid of that kind sends them all, its other
  grids' changes included. Event grids and registers keep their changes apart, as a register's save brings what an
  event grid's cannot (the events Capture schedules, its rows' refusals). A cell changed in both kinds before either is
  sent keeps both changes: the one sent last is what DHIS2 holds, and each kind waits for one of its own grids to be
  open to send. A grid shows what the other kind saved when it loads again. One loop per browser sends them, oldest
  first, 100 events at a time: each chunk's events are read, then imported, each request within its own minute. Two
  changes to one cell send only the latest. A chunk that fails keeps the chunks before it saved: refused as a whole, it
  refuses its own events and the chunks after it are sent next; otherwise it and the chunks after it are sent again. A
  change to an event DHIS2 no longer returns is refused ("This event was deleted or you no longer have access to it").
  Another tab's loop may send this tab's changes: the cells here still learn what became of them. A cell changed later
  in another tab shows that tab's value here once it is saved or refused. A status is saved while no tab is sending.
- After a reload, a grid puts back its own unsent changes, and the new rows it adds (same stage, org unit and person)
  that DHIS2 does not hold yet; the program's other changes stay on the device and are sent with the rest of their kind.
- Before every send, and before completing or reopening, the server is asked who is signed in. When it is someone else
  (another tab may have signed in, and tabs share the session), the form locks until the page is reloaded: every cell
  read-only and back to what DHIS2 had, nothing more sent, and the summary says "Signed in as someone else. Reload to
  continue as that user." The changes stay on the device for their user. A dropped connection pauses sending; an
  expired session pauses it, the summary asks the person to sign in, and sending starts again when they come back to
  the page.
- While anything is unsent or not saved, leaving the page asks first (the browser's own prompt). `downloadUnsent()`
  saves every change of the form DHIS2 does not have as a CSV file, with enough to enter it again by hand: the unsent
  ones, those DHIS2 refused, and a change this device could not store (then it is only on the page). The changes of
  the program's other grids that could not be saved are in it too, named by what this form knows of them (else by
  their row and field ids), and counted in `summary.failed`, so none is stuck where no grid shows it.
- A refusal keeps the value and marks the cell "Not saved" with DHIS2's reason; it is not sent again until the person
  enters the value again. Once downloaded, the changes that could not be saved can be dropped: `discardFailed()`,
  offered by the summary as "Discard changes that could not be saved" after it asks ("They are not saved anywhere else.
  Download them first to keep a copy."), takes them off the device, the program's other grids' too, and this form's
  cells go back to what DHIS2 has. A new
  event waits on the device until its event date is filled in, and, in a stage that checks required fields on every
  save, those fields too.
- The shared announcer says outcomes once things settle, failures assertively ("All changes saved", once nothing of the program is left
  on the device), each in turn, never progress.

## Boundaries

- Events load a page at a time, `pageSize` of them (default 50) in `order`. Events added or deleted elsewhere between
  pages shift DHIS2's pages: a row already shown is never shown twice, but one can be left out until the form loads
  again. Changing an event date in this grid can move its row to a later page, and so leave one event out the same way.
- Values are checked against their value type as they are typed; an option a rule hid is refused like any value that
  is not an option, unless the cell already holds it (a multi-select is checked code by code), so a person can keep
  or remove what was saved before the rule hid it.
- Program rules run for the source's `programStageIds` and the stages of the rows shown, pages included.
- Read-only, with the reason on each cell: events the user cannot write in that stage, skipped events, completed events
  in a stage that blocks entry, expired events (unless the user has `F_EDIT_EXPIRED`), and every event of a program with
  attribute categories. `TRACKER_ASSOCIATE`, `REFERENCE`, `GEOJSON`, and a pop-up type without an editor, show their
  value and are edited in their own form.
- An expiry period is worked out only on a server on the Gregorian or ISO 8601 calendar (`system/info`, asked in the
  form's own query; pages reuse it). On any other calendar no event is read-only for its period, and DHIS2 refuses an
  expired event when it is saved. A program with no expiry days never expires an event by its period, as in DHIS2.
- An org unit pasted into a cell shows its id until the form loads again. One picked but not yet sent shows its id
  after a reload too: names load only for the values DHIS2 holds. So does a file uploaded but not yet sent.
- A form loads once per mount, and not again when the app invalidates its queries; changes made elsewhere show after
  the next load.
