# Tally Sheet

A paper tally sheet on screen, for DHIS2 React 18 applications: a row per thing
counted (a dose, a diagnosis), a column per combination of category options (age
band and sex), and a large button in each cell. One tap is one mark. The counts
come from an append-only log of entries, so a sheet tallied on several devices
adds up the same once their logs are joined. The block knows nothing about the
DHIS2 Web API and saves nothing: storage stays with your app.

```sh
pnpm dlx shadcn@latest add devotta-labs/dhis2-blocks/tally-sheet
```

Its text goes through `@dhis2/d2-i18n` as literal `i18n.t` calls, so
`d2-app-scripts i18n extract` finds every string once the block is in your
app's `src`.

## Use it

```tsx
import { useMemo, useState } from 'react'
import {
    TallySheet,
    tallyCounts,
    type TallyEntry,
    type TallyLayout,
} from '@/components/tally-sheet'

const layout: TallyLayout = {
    categories: [
        {
            id: 'age',
            label: 'Age',
            options: [
                { id: 'under1', label: '0–11 months' },
                { id: 'over1', label: '12–23 months' },
            ],
        },
    ],
    rows: [
        { id: 'bcg', label: 'BCG', group: 'At birth' },
        { id: 'penta1', label: 'Penta 1', group: '6 weeks' },
    ],
    closed: [{ row: 'bcg', options: { age: 'over1' } }],
}

export const Session = ({ device }: { device: string }) => {
    const [log, setLog] = useState<readonly TallyEntry[]>([])
    const counts = useMemo(() => tallyCounts(layout, log), [log])
    return (
        <TallySheet
            layout={layout}
            label="Immunisation tally"
            by={device}
            entries={log}
            onAppend={(made) => setLog((before) => [...before, ...made])}
        />
    )
}
```

`counts` holds one `{ row, options, count }` for every open cell, zeros
included, so your app can save each one over the value it saved before. They
follow `layout.rows`, and within a row the columns; the grid may draw a
group's rows together in another order. A closed cell is listed only when the
log holds a count for it.

## API

`TallySheet` takes:

- `layout`: `rows` (`id`, `label`, optional `group`), `categories` (`id`,
  `label`, `options`) and `closed` cells. The columns are every combination of
  one option from each category, the last category changing fastest. A closed
  cell names a row and some options; every column with those options is hatched
  and takes no taps. The layout is compared by content, so an equal object
  made on every render keeps the sheet as it is; a layout with other content
  starts the sheet again from the log.
- `label`: names the grid's scroll region and the grid for screen readers.
- `entries`: the log, when your app keeps it. See "Receiving the log".
- `defaultEntries`: the log the sheet starts from when it keeps its own.
- `onAppend`: the entries each tap, undo or Done adds, and only those. It is
  the only way entries leave the sheet: a sheet without it keeps them in
  memory only.
- `by`: optional. Names this device on the entries it makes; undo takes back
  only entries with this name. Without it the sheet makes an id when it opens,
  so undo reaches the entries made since then. Pass a stable device or user id
  to keep undo across a reload and to name the device in a joined log. A new
  `by` starts the sheet again from the log.
- `editing`, `defaultEditing`, `onEditingChange`: edit mode, controlled or not.
- `RowBadge`: a component shown beside a row's label, given the `row` and its
  `total`, such as an alert past a threshold. Pass one stable component, not
  a new one on each render: a badge shows the component it was last given
  when its row's total changes.
- `children`: the parts, arranged. Without any, the sheet shows `TallyTotal`
  and `TallyEditButtons` on one line, then `TallyGrid`, then
  `TallyUndoButton`.

To start a new session, remount the sheet with a new `key`.

Parts, each taking a `className`: `TallyTotal` ("12 marks"),
`TallyEditButtons` ("Edit counts", or "Cancel" and "Done"), `TallyGrid` and
`TallyUndoButton` ("Undo last mark", disabled while editing).

Hooks, for parts of your own inside `TallySheet`: `useTally()` returns the
`layout`, `columns`, `editing`, `setEditing`, `tap(row, options)`, `undo()` and
`canUndo`; `useTallyCount(row, options)`, `useTallyRowTotal(row)` and
`useTallyTotal()` return counts. Each re-renders only when its number changes.

Helpers: `tallyColumns(layout)` lists the columns in order, with their options
and labels. `tallyCounts(layout, entries)` adds a log up.
`unplacedTallyEntries(layout, entries)` lists the entries the layout has no
place for: a row it no longer has, options it does not offer, or a correction
that is not a whole number. They stay in the log and are counted nowhere.
`mergeTallyEntries(...logs)` joins logs.

## The grid

Arrow keys move between open cells, Home and End to the ends of the row, and
Ctrl+Home and Ctrl+End to the ends of the sheet; the grid is one tab stop.
Holding Enter or Space adds one mark, not many. Each tap is announced with
its group, row, column and new count. The headings of the cell under the mouse
or holding focus are highlighted. "Edit counts" turns each cell, and each
closed cell that holds a count, into a number field; the arrows and Enter move
up and down a column. Fields keep only digits, in any script, up to six; a
field left empty keeps its count. Done saves the changed counts as one set of
corrections, and Cancel drops what was typed.

## The log

A log is a list of `TallyEntry`:

- `tap`: adds one to a row's cell in the column with these `options`.
- `correction`: adds `delta`, which may be below zero. Done writes one
  correction for each changed cell, all sharing a `batch`. Two corrections of
  the same cell made apart, on two devices or before and after a join, both
  apply.
- `settle`: brings a cell that joined logs left below zero back to zero. The
  sheet writes it before a tap on such a cell; your app only stores and
  merges it like any other entry.
- `undo`: takes back the entry `undoes` names.

Every entry has a unique `id` and an `at` time, and may have `by` and
`batch`. The log only grows. A count is the sum of what is left, never below
zero. Joining logs keeps each entry once by `id` and orders them by `at`, so
joined logs add up the same on every device whatever order they come in.
Undo takes back this device's latest tap, or its latest set of corrections
together.

## Receiving the log

Each `entries` the sheet is given is compared with the last one:

- A log that holds every entry of the last one is merged in, wherever the new
  entries sit, and the entries this sheet made that your app has not handed
  back yet are kept. So a tap counts even if the new log arrives late.
- A log with an entry of the last one missing is another session: it replaces
  everything, and ends edit mode without saving what was typed.

## What stays with your app

Storing the log (local storage, IndexedDB, or a DHIS2 data store namespace),
joining logs from other devices, and saving the counts. To save counts as
aggregate data values, map each count's `options` to the category option
combination with those options, and save every count, zeros included:

```
GET /api/categoryCombos/<id>?fields=categoryOptionCombos[id,categoryOptions[id]]
POST /api/dataValueSets
```
