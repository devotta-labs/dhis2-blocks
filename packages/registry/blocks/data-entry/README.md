# Data Entry

Grid data entry for DHIS2 events: one row per event and one column per data element, typed in like a spreadsheet.
Every change is kept on the device before it is sent, so nothing typed is lost to a dropped connection, a reload or
a crash. Program rules run for every row whose stage the grid shows, as Capture runs them. It builds on `dhis2-value-types` (what each value
type accepts), `dhis2-value-display` (the calendar) and `program-rules`.

```sh
pnpm dlx shadcn@latest add devotta-labs/dhis2-blocks/data-entry
```

`DataEntry` needs a React Query `QueryClientProvider` and the DHIS2 app-runtime provider above it, nothing else. Its
text goes through `@dhis2/d2-i18n` as literal `i18n.t` calls, so `d2-app-scripts i18n extract` finds every string once
the block is in your app's `src`.

## Use it

```tsx
import {
    DataEntry,
    DataEntrySummary,
    DataGrid,
    eventSource,
    useDataEntry,
} from '@/components/data-entry'

// Made once: a source with new keys loads the form again.
const inpatient = eventSource({
    programId: 'eBAyeGv0exc',
    orgUnitId: 'DiszpKrYNg8',
})

const Status = () => {
    const status = useDataEntry((view) => view.status)
    return status === 'ready' ? null : (
        <p>
            {status === 'loading' ? 'Loading…' : 'The form could not be loaded'}
        </p>
    )
}

export const InpatientGrid = () => (
    <DataEntry source={inpatient}>
        <Status />
        <DataGrid />
        <DataEntrySummary />
    </DataEntry>
)
```

The grid shows nothing until the form has loaded; show what you want with `useDataEntry((view) => view.status)`, and
why it could not load with `view.error`. Render your own `Cell`s only once `status` is `'ready'`: before that there are
no cells to bind them to. Several forms can share a page: each starts its DOM ids with its own prefix.

## API

```ts
DataEntry({ source, cells?, children }) // loads the form and keeps it; one per form
DataGrid({ tableId?, className? }) // the form's tables, or one of them
DataEntrySummary({ className? }) // every message as a link to its cell, the count not yet in DHIS2, the download, and discarding what could not be saved
Cell({ cellKey, field, labelledBy, move }) // one bound control with its notes and markers, for your own layouts
useCell(cellKey): CellView // one cell's value, draft, error, sync state and effects, and commit(text) to save it
useDataEntry(select): T // anything else, and the actions; select a value, not a new object
eventSource(options): DataEntrySource // the events of a program, a stage or one person
cells: Record<CellKind, CellComponent> // the default control per kind of field
```

```ts
interface DataEntryView {
    status: 'loading' | 'ready' | 'error'
    error?: string // why the form could not be loaded, while status is 'error'
    tables: ReadonlyArray<GridTable> // the form's tables as the grid shows them, new rows included
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

The host decides where the buttons go. `complete(rowId)` refuses at once, with one `failed` outcome per reason, when
the device is offline or someone else is signed in, and while the row has an error, an empty required field, or a
change DHIS2 refused or that waits; otherwise it sends the row's unsent changes first (and refuses if sending pauses),
then asks DHIS2. `reopen(rowId)` asks DHIS2 only for a completed row the user may reopen (`F_UNCOMPLETE_EVENT`, write
access to the stage, not expired), whether it was completed when loaded or here, and refuses the same way offline. A saved
status shows in the row's header and locks or unlocks the row where its stage blocks entry once completed.

`tables` gives the rows to lay such buttons out by:

```tsx
// A "Complete" button for each active row, beside the grid, named by the row's event date once it has one.
const CompleteButton = ({ row }: { row: GridRow }) => {
    const complete = useDataEntry((view) => view.complete)
    const { value: date } = useCell(`${row.id}.occurredAt`)
    return (
        <button type="button" onClick={() => void complete(row.id)}>
            Complete {date ?? row.label}
        </button>
    )
}

const CompleteButtons = () => {
    const tables = useDataEntry((view) => view.tables)
    return tables
        .flatMap(({ rows }) => rows)
        .filter(({ status }) => status === 'ACTIVE')
        .map((row) => <CompleteButton key={row.id} row={row} />)
}
```

A refusal comes back as `failed` outcomes with their `reason`; the summary lists what stops the row too.

## Replace a control

```tsx
const Notes: CellComponent = ({ id, cellKey, labelledBy, aria, readOnly, hidden }) => {
    const { value, draft, commit } = useCell(cellKey)
    return (
        <textarea
            key={`${hidden}:${value ?? ''}`} // starts again when the value changes elsewhere (an undo) or a rule hides it
            id={id}
            aria-labelledby={labelledBy}
            {...aria}
            defaultValue={hidden ? 'Hidden' : (draft ?? value)}
            readOnly={readOnly !== undefined}
            onBlur={(event) => {
                if (readOnly === undefined) {
                    commit(event.target.value)
                }
            }}
        />
    )
}

<DataEntry source={inpatient} cells={{ valueTypes: { LONG_TEXT: Notes }, fields: { qrur9Dvnyt5: Notes } }}>
```

A field's control wins over its value type's. The control gets `readOnly` (why it cannot be edited: the lock a rule or the
row puts on the cell), `hidden` (a rule hides it: show that, not the value), `id` and `aria`, besides the cell's props.
Put `id` on the one element that takes focus: the grid's focus and arrows and the summary's links find a cell by it.
Spread `aria` on the same element. `Cell` draws the cell's notes (why it cannot be edited, its errors and warnings,
whether it is saved) around every control, the required marker and the sync marker too; `aria-describedby` names those
notes, and `aria-invalid` and `aria-required` say whether the cell has an error and needs a value. The notes show while
focus is in the cell; Escape hides them, unless the control calls `preventDefault` on it. Paste and Ctrl+Z (Cmd+Z) are
the grid's only in the default controls: a replacement keeps its own, and a block pasted from the cells around it still
lands in it.
The default controls give value types this block does not know, and pop-up types without an editor, a read-only
reason of their own ("Edit this field in its own form"); a replacement is not given it. Keep the object stable (a module constant or
`useMemo`): a new one renders every cell again.

`useCell(cellKey).commit(text)` saves what a person typed or chose, through the store the default controls use. It
returns `'queued'` when the value changed (it is on the device, then sent), `'unchanged'` when it did not, and
`'invalid'` when its type or a rule's hidden options refuse it: the text stays as the cell's `draft` with its `error`,
and nothing is saved. A cell a rule locks, or whose row is read-only (`effects.readOnly`), is not written to
(`'unchanged'`); text typed into a cell a rule has hidden, and not locked, is saved, and the rule then clears it. To keep
a default control's editing, render it from `cells` (`<cells.text {...props} />`).

## Typing

Each cell works as a spreadsheet's does: typing replaces the value, F2 edits it, Enter and the arrows save and move,
Tab moves with the page, Escape puts the value back. Left and Right move the way they point, in a right-to-left page
too. A block copied from a spreadsheet pastes from the focused cell, skipping cells that cannot take it, and Ctrl+Z
(Cmd+Z) undoes the last change. A value its type refuses stays in the cell with its error and is not saved; nothing
typed is lost. In an option cell, typing lists the matches and Enter or Tab picks the highlighted one; emptied text
highlights none, so Enter or Tab clears the cell. Delete clears a checkbox, and `y`, `n` and Delete set a Yes/No field.

Pop-up types (`LONG_TEXT`, `MULTI_TEXT`, `AGE`, `COORDINATE`, `ORGANISATION_UNIT`, `USERNAME`, `FILE_RESOURCE` and
`IMAGE`) show their value as DHIS2 displays it (an age as its date of birth, in the system date format) and are edited
in a small editor, a dialog named "Edit …" that opens under the cell: Enter, F2, F4, Alt+↓, a click on the selected
cell or a double-click opens it, and so does typing in long text, org unit and username cells, starting from the text
typed (a key, or what a dead key or an input method composed). Tab and Shift+Tab stay inside the editor, and the cell's
notes hide while it is open. Escape or Cancel closes it without saving; a save goes through the cell's `commit` and
returns to the cell, where the next Enter moves on. A press outside the editor, or focus moved out of it, saves what
the editor last reported, or says why it cannot be saved. A rule that locks or hides the cell while its editor is open
closes it unsaved and says why. A pasted block fills pop-up cells like any cell, except files and images.

Long text opens a text area: Enter adds a line, Ctrl+Enter or ⌘+Enter saves, and a field mask is checked on save, which
keeps the editor open with its message. A multi-select opens a search over checkboxes (the shared option search, 50 at
most, in the option set's order, with the count line): a choice is saved with Save or by leaving the editor, as codes
in option-set order joined by commas, and "Clear all" saves no value. Options a rule hid are not offered, unless the
stored value holds one, which can still be unchecked.

An age opens its date of birth, typed and shown in the system calendar and date format, with years, months and days
beside it: typing in one fills the other, and a part left empty counts as zero. Retyping the age of a date of birth that
was given leaves that date, even where the age also reaches another day. A date in the future, and a part that is not a
whole number of zero or more (up to three digits), keep the editor open with a message, under the field it is about. A coordinate opens latitude and longitude
fields (no map, and no location from the device) and is saved as `[lng,lat]`; a latitude outside -90 to 90 or a
longitude outside -180 to 180 keeps the editor open with a message, and both fields empty save no value. Numbers are
read as number cells read them (`.5` is `0.5`; `+8` is refused). In both, Ctrl+Enter or ⌘+Enter in a field saves. A
coordinate is pasted as `lat, lng` or, with brackets, `[lng,lat]`; an age is pasted as a date in the system calendar and
date format.

An org unit opens a search of the org units in the user's search scope, by name, code or id, each listed with its path;
a username opens a search of DHIS2's user lookup, each listed with the user's name and username. A search starts at two
characters, once typing stops, and highlights the first result: ↑ and ↓ move the highlight, Enter or a click saves a
result, and Save or Ctrl+Enter saves the highlighted one (nothing, while the search still waits for its answer). Each
answer is announced ("Results: 2", the count line, or that none was found); a failed search says "You are offline" or
"Could not search. Try again.". The search opens on the cell's value; emptied, Save or leaving the editor clears it, and
leaving never saves a result that was not picked. An org unit cell shows the org unit's name: the names of the stored
values load with the form (200 ids a request, sent together, only when there are any; a request that fails leaves its
org units showing their ids, and the form opens all the same), and a pick shows its name at once. A username cell shows
the username.

A file or image cell shows the file's name, and an image DHIS2 holds for the event a small preview beside it (the
`SMALL` size; one that does not load leaves the name alone). The names of the stored files load with the form, as org
unit names do and at the same time (`fileResources`, 200 ids a request); a request that fails leaves its files showing
their ids. The editor offers "Choose a file" ("Choose an image", for images only) and, when the cell has a value,
"Remove", which saves no value. A chosen file is uploaded to DHIS2 at once (`POST /api/fileResources`, domain
`DATA_VALUE`), since a file cannot wait in the outbox; its id is then saved to the cell like any value, named from the
upload's answer, even when the upload finishes after the person has left the cell, which is then said ("Uploaded …", or
"Not saved: …" with the reason when the cell no longer takes it). A newer choice, "Remove" or Save in the cell stops an
upload still running from before. While it uploads the editor says "Uploading …"; Cancel or Escape stops the upload
and keeps the value. A failed upload keeps the value and says why: DHIS2's reason ("Could not upload the file: …"),
"Connect to the internet to upload files" without a connection, or "Could not upload the file. Try again.". Offline,
the editor says so and uploads nothing. A file DHIS2 holds for the event shows its name and "Download", and an image a
preview, both from the event's own endpoints (`/api/tracker/events/{event}/dataValues/{dataElement}/file` and
`/image`); a new file, not yet saved to the event, shows its name. File cells read each row as an event and each column
as a data element, as the event source makes them.

Dates are typed and shown in the system calendar and date format, and an empty date cell says the format
("Date format: DD-MM-YYYY"). A row is named by its event date in that format once it has one, its stage after it where
the grid shows several; a new row is "New event" until its date is typed.

## Program rules

Rules hide fields and options, make fields required, lock the values they assign and put their messages on cells.
Messages without a field show in the row's header, marked as a cell's are, and in the summary; what rules display
(texts and key-value pairs) shows under the row's label. A row whose rules fail shows the error in its header and keeps
none of their effects.

Opening the grid never changes data. In a row no one has changed, an assigned cell shows the value DHIS2 holds, locked
with "Assigned by rule: …", and a hidden cell shows "Hidden"; the rule's value appears once the row is changed. The
values rules assign, and the clearing of fields they hide, are saved only with a row a person changes or completes, or
that has unsent changes; they are saved with the person's change. A cleared cell says "Cleared by rule: …" until it
holds a value again, and text typed into a cell a rule hides is saved, then cleared the same way. A rule never changes
the cell being typed in; it does once the person leaves the cell. A form whose rules are still loading cannot complete
a row; if they cannot be loaded, the summary says so and nothing completes.

On load the rows in view are evaluated first, for about 100 ms, and the rest about 16 ms at a time when the browser is
idle. An edit re-runs its row, and every row of that person when other events read the field or the event date changed,
once the browser has shown the edit, so typing never waits for rules; completing a row runs them first.
The `performance` measures `data-entry:rules` (the first slice) and `data-entry:rules-edit` (each edit) time them.

## Saving

- Every change goes to an IndexedDB outbox on this device, `dhis2-data-entry:<server>:<user id>`, before it is sent,
  once the browser has shown it and together with the values its rules assign, so both are sent in one save; when the
  page is hidden or closed, at once. It opens only for the same user on the same server. Nothing is encrypted.
- Unsent changes belong to the program, not the grid: every grid of a program keeps one record per cell (the newer
  change wins), and any open grid of the program sends them all, its other grids' changes included. One loop per
  browser sends them, oldest first, 100 events at a time: each chunk's events are read, then imported, each request
  within its own minute. Two changes to one cell send only the latest. A chunk that fails keeps the chunks before it
  saved: refused as a whole, it refuses its events and those after it; otherwise only those are sent again. A change to
  an event DHIS2 no longer returns is refused ("This event was deleted or you no longer have access to it"). Another
  tab's loop may send this tab's changes: the cells here still learn what became of them.
- After a reload, a grid puts back its own unsent changes, and the new rows it adds (same stage, org unit and person)
  that DHIS2 does not hold yet; the program's other changes stay on the device and are sent with the rest.
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
- One polite live region says outcomes once things settle ("All changes saved", once nothing of the program is left
  on the device), each in turn, never progress.

## Boundaries

- Only the first page of events loads: `pageSize` of them (default 50), in `order`.
- Values are checked against their value type as they are typed; an option a rule hid is refused like any value that
  is not an option, unless the cell already holds it (a multi-select is checked code by code), so a person can keep
  or remove what was saved before the rule hid it.
- Program rules run for the rows whose stage the grid shows: the source's `programStageIds` (for `eventSource`, the
  stages of the loaded events and of new rows, or the stage asked for when there are none). A row of any other stage is
  not evaluated.
- Read-only, with the reason on each cell: events the user cannot write in that stage, skipped events, completed events
  in a stage that blocks entry, expired events (unless the user has `F_EDIT_EXPIRED`), and every event of a program with
  attribute categories. `TRACKER_ASSOCIATE`, `REFERENCE`, `GEOJSON`, and a pop-up type without an editor, show their
  value and are edited in their own form.
- An org unit pasted into a cell shows its id until the form loads again. One picked but not yet sent shows its id
  after a reload too: names load only for the values DHIS2 holds. So does a file uploaded but not yet sent.
- A form loads once per mount, and not again when the app invalidates its queries; changes made elsewhere show after
  the next load.
