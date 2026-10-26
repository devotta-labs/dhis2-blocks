# Data Entry

Grid data entry for DHIS2 events: one row per event and one column per data element, typed in like a spreadsheet.
Every change is kept on the device before it is sent, so nothing typed is lost to a dropped connection, a reload or
a crash. Program rules run for every row whose stage the grid shows, as Capture runs them. It builds on `dhis2-value-types` (what each value
type accepts), `dhis2-value-display` (the calendar) and `program-rules`.

```sh
pnpm dlx shadcn@latest add devotta-labs/dhis2-blocks/data-entry
```

`DataEntry` needs a React Query `QueryClientProvider` and the DHIS2 app-runtime provider above it, nothing else.

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

The grid shows nothing until the form has loaded; show what you want with `useDataEntry((view) => view.status)`.
Render your own `Cell`s only once `status` is `'ready'`: before that there are no cells to bind them to.

## API

```ts
DataEntry({ source, cells?, children }) // loads the form and keeps it; one per form
DataGrid({ tableId?, className? }) // the form's tables, or one of them
DataEntrySummary({ className? }) // every message as a link to its cell, the count not yet in DHIS2, and the download
Cell({ cellKey, field, labelledBy, move }) // one bound control, for your own layouts
useCell(cellKey): CellView // one cell's value, draft, error, sync state and effects, and commit(text) to save it
useDataEntry(select): T // anything else, and the actions; select a value, not a new object
eventSource(options): DataEntrySource // the events of a program, a stage or one person
cells: Record<CellKind, CellComponent> // the default control per kind of field
```

```ts
interface DataEntryView {
    status: 'loading' | 'ready' | 'error'
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

## Replace a control

```tsx
const Notes: CellComponent = ({ id, cellKey, labelledBy, readOnly, hidden }) => {
    const { value, draft, error, commit } = useCell(cellKey)
    return (
        <textarea
            key={`${hidden}:${value ?? ''}`} // starts again when the value changes elsewhere (an undo) or a rule hides it
            id={id}
            aria-labelledby={labelledBy}
            aria-invalid={error !== undefined}
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
row puts on the cell), `hidden` (a rule hides it: show that, not the value) and `id`, besides the cell's props. Put `id`
on the one element that takes focus: the grid's focus and arrows, paste, undo and the summary's links find a cell by it.
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
Tab moves with the page, Escape puts the value back. A block copied from a spreadsheet pastes from the focused cell,
skipping cells that cannot take it, and Ctrl+Z (Cmd+Z) undoes the last change. A value its type refuses stays in the
cell with its error and is not saved; nothing typed is lost.

## Program rules

Rules hide fields and options, make fields required, lock the values they assign and put their messages on cells
(messages without a field go on the row). What they display (texts and key-value pairs) shows under the row's label. A
row whose rules fail shows the error on the row and keeps none of their effects.

Opening the grid never changes data. In a row no one has changed, an assigned cell shows the value DHIS2 holds, locked
with "Assigned by rule: …", and a hidden cell shows "Hidden"; the rule's value appears once the row is changed. The
values rules assign, and the clearing of fields they hide, are saved only with a row a person changes or completes, or
that has unsent changes; they are saved with the person's change. A cleared cell says "Cleared by rule: …" until it
holds a value again, and text typed into a cell a rule hides is saved, then cleared the same way. A rule never changes
the cell being typed in; it does once the person leaves the cell. A form whose rules are still loading cannot complete
a row; if they cannot be loaded, the summary says so and nothing completes.

On load the rows in view are evaluated first, for about 100 ms, and the rest about 16 ms at a time when the browser is
idle. An edit re-runs its row, and every row of that person when other events read the field or the event date changed.
The `performance` measures `data-entry:rules` (the first slice) and `data-entry:rules-edit` (each edit) time them.

## Saving

- Every change goes to an IndexedDB outbox on this device, `dhis2-data-entry:<server>:<user id>`, before it is sent.
  It opens only for the same user on the same server. Before every send, and before completing or reopening, the
  server is asked who is signed in; when it is not that user (another tab may have signed in as someone else, and
  tabs share the session), sending pauses until that user signs in again. Nothing is encrypted.
- One loop per browser sends them, oldest first, one request per form; two changes to one cell send only the latest.
  Another tab's loop may send this tab's changes: the cells here still learn what became of them. A dropped connection
  pauses sending; an expired session pauses it, and the summary asks the person to sign in.
- While anything is unsent or not saved, leaving the page asks first (the browser's own prompt). `downloadUnsent()`
  saves every unsent change of the form as a CSV file, with enough to enter it again by hand, including a change this
  device could not store (then it is only on the page).
- A refusal keeps the value and marks the cell "Not saved" with DHIS2's reason; it is not sent again until the person
  enters the value again. A new event waits on the device until its event date is filled in, and, in a stage that checks
  required fields on every save, those fields too.
- One polite live region says outcomes once things settle ("All changes saved"), never progress.

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
- A form loads once per mount; changes made elsewhere show after the next load.
