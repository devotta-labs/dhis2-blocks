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
The default controls give the pop-up types and value types this block does not know a read-only reason of their own
("Edit this field in its own form"); a replacement is not given it. Keep the object stable (a module constant or
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
  is not an option.
- Program rules run for the rows whose stage the grid shows: the source's `programStageIds` (for `eventSource`, the
  stages of the loaded events and of new rows, or the stage asked for when there are none). A row of any other stage is
  not evaluated.
- Read-only, with the reason on each cell: events the user cannot write in that stage, skipped events, completed events
  in a stage that blocks entry, expired events (unless the user has `F_EDIT_EXPIRED`), and every event of a program with
  attribute categories. `LONG_TEXT`, `MULTI_TEXT`, `AGE`, `COORDINATE`, `ORGANISATION_UNIT`, `USERNAME`,
  `FILE_RESOURCE` and `IMAGE` show their value and are edited in their own form.
- A form loads once per mount, and not again when the app invalidates its queries; changes made elsewhere show after
  the next load.
