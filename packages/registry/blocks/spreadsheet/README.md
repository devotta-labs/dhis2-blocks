# Spreadsheet

A grid of DHIS2-typed cells entered like a spreadsheet: Excel-style keys, paste and undo, pop-up editors, searching
cells, and the state of each cell (saved, waiting, failed) for any data your app saves. It knows nothing about programs,
people or rules, and nothing about the DHIS2 Web API beyond what its cells need: org unit and user search, file
upload, and showing the file or image an event holds. It builds on `dhis2-value-types` (what each value type accepts) and `dhis2-value-display` (the calendar).

```sh
pnpm dlx shadcn@latest add devotta-labs/dhis2-blocks/spreadsheet
```

`Spreadsheet` needs the DHIS2 app-runtime provider above it, for the data engine, nothing else. Its text goes through
`@dhis2/d2-i18n` as literal `i18n.t` calls, so `d2-app-scripts i18n extract` finds every string once the block is in
your app's `src`.

## Use it

You build a cell store, an annotations store and the tables, and `Spreadsheet` hands them to the grid and its cells.

```tsx
import { useMemo } from 'react'
import {
    Spreadsheet,
    SpreadsheetGrid,
    createCellStore,
    type AnnotationsState,
    type GridTable,
} from '@/components/spreadsheet'

const targets: GridTable = {
    id: 'targets',
    title: 'Yearly targets',
    rows: [{ id: 'OrgUnitA01', label: 'Hospital A' }],
    columns: [{ id: '2026', label: '2026' }],
    headerRows: [[{ id: '2026', label: '2026', span: 1 }]],
    closed: new Map(),
}

// A store that never changes: a grid with no rules has nothing to say about a cell.
const none: AnnotationsState = {
    cells: {},
    rowMessages: new Map(),
    rowNotes: new Map(),
}
const annotations = {
    getState: () => none,
    getInitialState: () => none,
    subscribe: () => () => {},
}

const settings = { calendar: 'iso8601', dateFormat: 'YYYY-MM-DD' } as const

export const Targets = () => {
    // Made once: a new store starts the grid again.
    const cells = useMemo(
        () =>
            createCellStore({
                fields: new Map([
                    ['target', { valueType: 'INTEGER_POSITIVE' }],
                ]),
                fieldIdOf: () => 'target',
                values: new Map(),
                settings,
                annotations, // the store you pass to `<Spreadsheet annotations>` below
                enqueue: (key, value, base) => save(key, value, base), // yours: where a committed value goes
            }),
        []
    )
    return (
        <Spreadsheet
            cells={cells}
            annotations={annotations}
            tables={[targets]}
            settings={settings}
        >
            <SpreadsheetGrid />
        </Spreadsheet>
    )
}
```

## API

```ts
Spreadsheet({ cells, annotations, tables, settings, keyOf?, rowKeysOf?, idScope?, overrides?, addRow?, orgUnitNames?, fileNames?, offline?, fileUrl?, announcer?, RowLabel?, RowBadge?, GridFooter?, bulkColumn?, confirmBulk?, children }) // the provider; renders the one polite live region after its children
SpreadsheetGrid({ tableId?, className? }) // every table, or one of them
Cell({ cellKey, field, labelledBy, move }) // one bound control with its notes and markers, for your own layouts
cells: Record<CellKind, CellComponent> // the default control per kind of field
useCell(cellKey): CellView // one cell's value, draft, error, sync state and annotations, and commit(text) to save it
useRowCells(keys) // the states and annotations of a row's cells, in the order of keys
useAnnounce(): (text: string) => void // says an outcome in the live region
useFocusCell(): (key: CellKey) => void // focuses a cell, drawing its row first when the grid has scrolled past it
createCellStore(options): StoreApi<CellStoreState> // the cells' values and states
createAnnouncer(): Announcer // an announcer to pass to Spreadsheet, for code outside the grid that says outcomes too
cellKey(rowId, fieldId): CellKey // `<row id>.<column id>`; a row id contains no dot
```

Also exported, for a block that composes the grid: `indexCells(tables, keyOf)`, `cellDomId`, `rowHeaderDomId`,
`typingIn`, `nameFrom`, `formatCount`, the `CellStoreState` type, and the types `GridTable`, `GridRow`, `GridColumn`,
`HeaderCell`, `CellKey`, `CellState`, `CellView`, `CommitResult`, `SyncState`, `NavKey`, `CellOverrides`,
`CellComponent`, `CellProps`, `ControlProps`, `DataEngine`, `Tone`, `CellMessage`, `CellAnnotations` and
`AnnotationsState`.

```ts
interface CellStoreOptions {
    fields: ReadonlyMap<string, Field> // every field a cell may hold, by id: what a value is checked against
    fieldIdOf?(key: CellKey): string // the id in `fields` of a cell's field; the part of its key after the first dot by default
    values: ReadonlyMap<CellKey, string> // what the cells hold when the grid opens
    settings: ValueSettings // the system calendar and date format
    enqueue(key: CellKey, value: string | null, base: string | null): void // every change that must be saved; null clears the cell
    annotations: ReadonlyStore<AnnotationsState> // what the rules say of each cell, read when a person writes
    locked?(key: CellKey): boolean // the cell's record cannot be changed: no commit, and no undo writes to it
}

interface GridTable<
    R extends GridRow = GridRow,
    C extends GridColumn = GridColumn,
> {
    id: string
    title: string
    rows: R[]
    columns: C[]
    headerRows: HeaderCell[][] // `{ id, label, span, rowSpan? }`
    closed: ReadonlyMap<CellKey, string> // cells with no control, skipped by the arrows, with their reason
}
interface GridRow {
    id: string
    label: string
    labelFrom?: ReadonlyArray<CellKey>
} // labelFrom names the row by these cells' values
interface GridColumn {
    id: string
    label: string
}
```

### Keys and fields

A cell is found by its key. `keyOf(row, column)` on `Spreadsheet` says which key a row has for a column; the default is
`cellKey(row.id, column.id)`. A cell's field, and so its value type, comes from its key, not its column:
`createCellStore({ fieldIdOf })` picks the field's id from the key, by default the part after the dot. A grid of data
elements (rows) by category option combinations (columns) passes `(key) => key.slice(0, key.indexOf('.'))`, so each
row has its own value type. Two cells of a table with one key throw: they would save to one place.

### Annotations

`annotations` is what logic says about each cell and row: program rules, validation rules or your own code. The grid
reads it and never writes it, so pass any store with `getState`, `getInitialState` and `subscribe` whose state has at
least this shape; a richer store of your own works as it is.

```ts
type Tone = 'error' | 'warning' // shown in red and in yellow

interface CellMessage {
    tone: Tone
    text: string
}

interface CellAnnotations {
    readOnly?: string // why the cell cannot be edited
    hiddenBy?: string // why the cell is hidden
    required: boolean
    messages: ReadonlyArray<CellMessage>
    hiddenOptions?: ReadonlySet<string> // option codes the cell does not offer
}

interface AnnotationsState {
    cells: Partial<Record<CellKey, CellAnnotations>> // only cells there is something to say about
    rowMessages: ReadonlyMap<string, ReadonlyArray<CellMessage>> // row id → messages without a cell, shown in the row's header
    rowNotes: ReadonlyMap<string, ReadonlyArray<string>> // row id → notes, behind a marker in the row's header
}
```

A row's messages and notes are stored under its row keys: `rowKeysOf(row)` on `Spreadsheet`, `[row.id]` by default. The
header gathers them across all of them and shows each tone and text once. A row's notes show as a marker with their
count ("Note", "Notes: 2") that opens them as plain text, line breaks kept, in a popover, so the row stays one line; the
marker is out of the Tab order, and the row header's description holds the notes for screen readers. Value-type errors
come from the cell store and required from `CellAnnotations.required`, so both show with an annotations store that never
changes.

### Around the grid

- `addRow`: a map by table id of `{ label, add() }`. A table in it is followed by a button with that label ("Add event",
  "Add person") that runs `add`, as does Ctrl+Enter in its cells; the grid then focuses the new row's first open cell.
- `RowLabel({ row })`: names a row in its header; by default its `labelFrom` cells' values, else its `label`.
- `RowBadge({ rowId })`: shown beside the row's label, and named with the row only, not with each of its cells.
- `GridFooter({ skipTargetId })`: rendered once after every table and the "Skip past the grid" target; `skipTargetId` is
  the DOM id of the place that link leads to, where focus goes when what the footer holds goes away.
- `orgUnitNames`, `fileNames`: stores of names by id (`{ names: ReadonlyMap<string, string> }`) for org unit and file
  cells; each has a store of its own by default.
- `bulkColumn(column)`: whether the column's cells take row and column actions; every column by default. A column whose
  cells do not all share one field offers no column action either way.
- `confirmBulk(keys)`: asked before a bulk action or a block paste writes to these cells; returns `{ title, body, confirm }` for a dialog
  that asks the person first, or `undefined` to write at once.
- `offline`: the server cannot be reached now, so files cannot be uploaded.
- `fileUrl(key, image)`: where the server serves the file a cell's saved value names (`image` for an image cell), or
  `undefined`. Without it, file and image cells show the file's name only: no preview and no "Download".
- `idScope`: starts every DOM id of the grid, so two grids on one page never share one; a generated one by default.
- `announcer`: made with `createAnnouncer()`, for code outside the grid that says outcomes through the same live region.

## Saving

The grid saves nothing itself. A change that passes the field's checks goes to `enqueue(key, value, base)`, with `base`
what the cell held when it was loaded or last confirmed. Your code sends it and reports back through the store's state:

- `markSync(sent, sync, reason?)` records what became of the values sent (`saved`, `waiting`, `failed`, with `reason`
  shown on the cell). A cell that has changed since keeps its newer change's state; `saved` still moves its base to the
  value that was sent.
- `restore(changes)` puts changes your code still holds, or values a page loads, on their cells. Nothing is enqueued, and
  a cell's draft and its error stay.
- `undo()` reverts the person's last commit, every cell of it, as new changes, which go to `enqueue`.
- `commit(key, text, source?)` and `commitMany(entries, source?)` check text and queue a change; `source` is `'person'`
  or `'rule'`, how a value written by logic is told from a person's. `discardDraft` and `keepDraft` drop or keep text a
  pop-up editor could not save.

## Bulk actions

One value or one row can fill many cells at once. Every action is one write through the same path as typing and paste, so
it is one undo step (Ctrl+Z, Cmd+Z), and the rules re-run on the rows it touched.

- **Row menu**: the "Row actions" button (⋯) in the last column, which stays in view as the table scrolls, opens
  "Apply to next row", "Apply to all rows below" and "Clear row". The last row offers only "Clear row". A row copy
  carries the row's values to the same columns of the target rows, leaving out values hidden by a rule.
- **Column menu**: the "Column actions" button in a column's header opens "Apply value to all column cells" and "Clear all
  column cells". Apply opens a popover with the column's own control, an "Overwrite existing values" checkbox, a preview
  and **Apply** and **Cancel**; Apply saves text still being typed and waits for a valid value. A column whose cells do not all share one field, or that
  `bulkColumn` leaves out, has no column button. "Apply value to all column cells" is not offered for kinds the grid cannot
  type into (file and image columns, and others a paste refuses, unless a replacement control edits them); "Clear all column
  cells" still is.
- **Context menu**: right-click a cell, or press Shift+F10, the Menu key or Ctrl+Shift+\ (Cmd+Shift+\ on a Mac) on it,
  for one menu with a "Row" and a "Column" group. The buttons are out of the Tab order and are not part of the grid, so
  the arrow keys never reach them.
- **Ctrl+D (Cmd+D)**: on a cell, types the value of the cell above it in the same table, replacing what is there. A value
  its type refuses stays in the cell with its error, as typing does. With no row above, nothing in the cell above (or a
  hidden or closed cell above), or a cell that cannot be edited, it says "Nothing above to copy." or the cell's own reason. The browser's shortcut is left
  alone unless the grid handled the key.

An action never overwrites by default: a cell is empty with no value and no draft, and one that is not is left alone
unless "Overwrite existing values" is ticked (a clear always overwrites). A cell that holds the value already is not
written, and not counted as changed. Cells that cannot be edited are skipped and counted
under their reason: closed, read-only, hidden by a rule, a kind that cannot be filled ("Edit this field in its own form"),
or an option the cell does not offer. The preview ("Changes 12 cells. 3 already have a value. 2 skipped: Completed.") and
the summary said afterwards ("Cells changed: 12. 2 skipped: Completed.", the most common reason) come from the same plan
as the write.

```ts
bulkColumn?(column: C): boolean // default: every column
confirmBulk?(keys: ReadonlyArray<CellKey>): { title: string; body: string; confirm: string } | undefined
```

`confirmBulk` is asked with the cells a bulk action or a block paste would write; a result opens a dialog with that title and body and a
confirm button (and **Cancel**) before anything is written.

## Typing

Each cell works as a spreadsheet's does: typing replaces the value, F2 edits it, Enter and the arrows save and move,
Tab moves with the page, Escape puts the value back. Left and Right move the way they point, in a right-to-left page
too. A block copied from a spreadsheet pastes from the focused cell, skipping cells that cannot take it, and Ctrl+Z
(Cmd+Z) undoes the last change. In a table with an add-row button, Ctrl+Enter (Cmd+Enter) saves what was typed, adds a row
and moves to its first open cell; text its type refuses stays to be fixed, and no row is added. A note pasted into a long-text cell stays in that cell, line breaks kept, unless it
holds a tab; a pasted value keeps its quotes unless it is one quoted field, as a spreadsheet wraps a cell. A value its type refuses stays in the cell with its error and is not saved; nothing
typed is lost. In an option cell, typing lists the matches and Enter or Tab picks the highlighted one; emptied text
highlights none, so Enter or Tab clears the cell. Space, F4 or Alt+↓ lists every option. A Yes/No field is an option cell with Yes and No, except that `y`,
`n` and Delete set it at once. Delete clears a checkbox.

Org unit and username cells search DHIS2 as they are typed in, and list what it finds under the cell: org units in
the user's search scope, by name, code or id, each with its path; users through DHIS2's user lookup, each with the
user's name and username. A search starts at two characters, once typing stops, and highlights the first result: ↑
and ↓ move the highlight, and Enter, Tab or a click picks it. While the search for what the cell holds waits for its
answer, Enter and Tab do nothing. Each answer is announced ("Results: 2", the count line, or that none was found); a
failed search says "You are offline" or "Could not search. Try again." under the cell. Only a picked result is saved:
other typing is dropped when the cell is left, and emptied text clears the cell. An org unit cell shows the org unit's
name: the names come from the `orgUnitNames` store you pass, and a pick shows its name at once. A username cell shows the username. A pasted block fills org unit cells and skips username cells, which DHIS2
checks as they are typed.

Pop-up types (`LONG_TEXT`, `MULTI_TEXT`, `AGE`, `COORDINATE`, `FILE_RESOURCE` and `IMAGE`) show their value as DHIS2 displays it (an age as its date of birth, in the system date format) and are edited
in a small editor, a dialog named "Edit …" that opens under the cell: Enter, F2, F4, Alt+↓, a click on the selected cell
or a double-click opens it, and so does typing in long text cells, starting from the text typed
(a key, or what a dead key or an input method composed). Tab and Shift+Tab stay inside the editor, and the cell's notes
hide while it is open. Escape or Cancel closes it without saving; a save goes through the cell's `commit` and returns to
the cell, where the next Enter moves on. A press outside the editor, or focus moved out of it, saves what the editor
last reported; what it cannot save stays in the cell as refused typing does, as its draft with the problem (a long text
as typed, a coordinate as `lat, lng`, an age as its date of birth or as "Years: 1, months: 2, days: -3"), and Escape on
the cell drops it. Opened again, the editor starts from the stored value, not the draft. Annotations that lock or hide the
cell while its editor is open closes it unsaved and says why. A pasted block fills pop-up cells like any cell, except
files and images.

Long text opens a text area: Enter adds a line, Ctrl+Enter or ⌘+Enter saves, and a field mask is checked on save, which
keeps the editor open with its message. A multi-select opens a search over checkboxes (the shared option search, 50 at
most, in the option set's order, with the count line): a choice is saved with Save or by leaving the editor, as codes
in option-set order joined by commas, and "Clear all" saves no value. Options the annotations hide are not offered, unless the
stored value holds one, which can still be unchecked.

An age opens its date of birth, typed and shown in the system calendar and date format, with years, months and days
beside it: typing in one fills the other, and a part left empty counts as zero. Retyping the age of a date of birth that
was given leaves that date, even where the age also reaches another day. A date in the future, and a part that is not a
whole number of zero or more (up to three digits), keep the editor open with a message, under the field it is about. A coordinate opens latitude and longitude
fields (no map, and no location from the device) and is saved as `[lng,lat]`; a latitude outside -90 to 90 or a
longitude outside -180 to 180 keeps the editor open with a message, and both fields empty save no value. Numbers are
read as number cells read them (`.5` is `0.5`; `+8` is refused). In both, Ctrl+Enter or ⌘+Enter in a field saves. A
coordinate is pasted as `lat, lng` or, with brackets, `[lng,lat]`; an age is pasted as a date in the system calendar and
date format, and a date of birth in the future is refused there too.

A file or image cell shows the file's name, and a saved image `fileUrl` gives an address for a small preview beside it
(the `SMALL` size; one that does not load leaves the name alone). The names of files come from the `fileNames` store you pass; a file with no name there shows its id. The editor offers "Choose a file" ("Choose an image", for images only) and, when the cell has a value,
"Remove", which saves no value. An image cell uploads nothing that is not an image (a `type` that is set and does not
start with `image/`; some systems give HEIC images none) and says "Choose an image file" at once, even while an earlier
upload runs. A chosen file is uploaded to DHIS2 at once (`POST /api/fileResources`, domain
`DATA_VALUE`), since a file cannot wait in the outbox; its id is then saved to the cell like any value, named from the
upload's answer, even when the upload finishes after the person has left the cell, which is then said ("Uploaded …", or
"Not saved: …" with the reason when the cell no longer takes it). A newer choice, "Remove" or Save in the cell stops an
upload still running from before. While it uploads the editor says "Uploading …"; Cancel or Escape stops the upload
and keeps the value. A failed upload keeps the value and says why: DHIS2's reason ("Could not upload the file: …"),
"Connect to the internet to upload files" without a connection, or "Could not upload the file. Try again.". Offline,
the editor says so and uploads nothing. A saved file shows its name and "Download", and an image a preview, both from
the address `fileUrl` gives; a new file, not saved yet, or one `fileUrl` gives no address for, shows its name only.

Dates are typed and shown in the system calendar and date format, and an empty date cell says the format
("Date format: DD-MM-YYYY").

## Replace a control

```tsx
import { Spreadsheet, SpreadsheetGrid, useCell, type CellComponent } from '@/components/spreadsheet'

const Notes: CellComponent = ({ id, cellKey, labelledBy, aria, readOnly, hidden }) => {
    const { value, draft, commit } = useCell(cellKey)
    return (
        <textarea
            key={`${hidden}:${value ?? ''}`} // starts again when the value changes elsewhere (an undo) or annotations hide it
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

// A module constant: a new object renders every cell again.
const overrides = { valueTypes: { LONG_TEXT: Notes }, fields: { qrur9Dvnyt5: Notes } }

<Spreadsheet cells={cells} annotations={annotations} tables={tables} settings={settings} overrides={overrides}>
```

`overrides` replaces the control for a value type or for one field by id; a field's control wins over its value type's. The control gets `readOnly` (why it cannot be edited: the lock your annotations
put on the cell), `hidden` (annotations hide it: show that, not the value), `id` and `aria`, besides the cell's props.
Put `id` on the one element that takes focus: the grid's focus and arrow keys find a cell by it. A block that composes the grid finds a cell the same way, with
`cellDomId(idScope, cellKey)`.
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
`'invalid'` when its type, the annotations' hidden options, or (for an age) a date of birth in the future refuse it: the text stays as the cell's `draft` with its `error`,
and nothing is saved. A person's commit to a cell the annotations make read-only (`annotations.cells[key].readOnly`, which
`useCell(key).effects.readOnly` shows) or hide is `'unchanged'`: nothing is saved and no draft is kept. A rule's commit
(`source: 'rule'`) passes the gate. To keep
a default control's editing, render it from `cells` (`<cells.text {...props} />`) in your control: a default control
reads its cell from the `Cell` around it, so it is drawn only inside one.

## Boundaries

- The grid is DHIS2-typed: a cell's field has a DHIS2 value type, and its value is stored as DHIS2 stores it.
- Values are checked against their value type as they are typed. A person's write to a cell the annotations hide or make
  read-only is `'unchanged'`: nothing is saved and no draft is kept. An option the annotations hide is refused like any
  value that is not an option (`Choose one of the options`), unless the cell already holds it (a multi-select is checked
  code by code). A rule's own commit is not gated. `undo` skips a cell the annotations now close.
- `TRACKER_ASSOCIATE`, `REFERENCE`, `GEOJSON`, and a pop-up type without an editor, show their value and are edited in
  their own form, or in a replacement control.
- File cells upload through `POST /api/fileResources` with the app-runtime's data engine, since a file cannot wait for your
  code to send it. Where a saved file is served from is yours to say, with `fileUrl`.
- Option cells keep a hand-built list: the `combobox` primitive cannot pick on Tab, keeps Escape and Home/End for itself, renders its own input chrome and a portalled popup that cannot hang under the cell inside the table, so the cell's key table, modes and popover placement would need the primitive's behaviour disabled.
- The grid shows the tables it is given. Loading, sending, offline handling and completion belong to the block that
  composes it, such as `tracker-data-entry`.
