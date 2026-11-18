# Data Table

A generic, composable data table over any row type, built on TanStack Table
v9. `useDataTable` creates the table in client mode (the table filters, sorts
and pages `data`) or server mode (`data` is one already-processed page and the
caller runs the query from the table state). `DataTable` provides the table and
the view state to the parts rendered inside it. The block knows nothing about
DHIS2 metadata: columns, cell formatters and filters belong to the caller.

## API

- `DataTable`, `DataTableProps`
- `useDataTable`, `UseDataTableOptions`
- `createDataTableColumnHelper`
- `useDataTableInstance`
- `useDataTableView`, `DataTableViewContextValue`
- `dataTableColumnLabel`
- `dataTableFeatures`, `DataTableFeatures`
- `DataTableInstance`, `DataTableColumnDef`, `DataTableRow`, `DataTableCell`,
  `DataTableColumn`, `DataTableHeaderCell`, `DataTableState`
- `DataTableDensity`, `DataTableLayout`, `DataTableStatus`, `DataTableMode`,
  `DataTableColumnMeta`
- `DataTableFilter`, `DataTableTextFilter`, `DataTableNumberFilter`,
  `DataTableDateFilter`, `DataTableOptionsFilter`, `DataTableBooleanFilter`,
  `DataTableCustomFilter`, `DataTableCustomFilterControlProps`,
  `DataTableFilterOption`, `DataTableFilterValue`, `DataTableTextOperator`
- `dataTableFilterValueSchema`, `parseDataTableFilterValue`,
  `isDataTableFilterValueEmpty`, `dataTableFilterFn`

## Grid

```tsx
<DataTable table={table} label="People" layout="fixed">
    <DataTableContent columnMenu onRowOpen={(row) => open(row.original)} />
    <DataTablePagination />
</DataTable>
```

### Table

`DataTableContent` draws the header, the body and, when a column defines a
`footer`, the footer, in a scroll container. The table is named by
`DataTable`'s `label`. It sets `aria-rowcount` (header rows, every row of the
result and footer rows; -1 in server mode without `rowCount`) and
`aria-rowindex` on each row. `maxHeight` (a number is px) makes the body
scroll; `stickyHeader` and `virtualized` need it. In layout `'fixed'` the table
is as wide as its columns (`size`, default 180, between 64 and 640).

To compose the parts yourself, pass `DataTableHeader`, `DataTableBody` and
`DataTableFooter` as children. They read `DataTableContent`'s options from
context, and props given to `DataTableBody` win over them.

### Header

A sortable header is a button that cycles ascending, descending and none, with
`aria-sort` on the header cell. `meta.align` aligns the header and its cells;
`meta.nowrap` keeps the cells on one line. `columnMenu` adds an "Options for
{column}" menu to each header: sort, pin (layout `'fixed'`), group (columns
with `enableGrouping: true`) and hide (while another column stays visible).

### Body

`onRowOpen(row)` opens a row on click, except a click on a control inside it,
and gives each row a visually hidden "Open row {{number}}" button
(`rowOpenLabel(row)` names it) for the keyboard. The row shows a focus ring
while that button has keyboard focus. Group rows do not open. The number is
the row's position among the rows drawn on the page, from 1; the row checkbox
("Select row {{n}}") and the expander ("Expand row {{n}}", "Collapse row
{{n}}") use the same number.

### States

The body follows `DataTable`'s `status`. `'loading'` draws skeleton rows (as
many as a page holds, at most 10); `'updating'` keeps the rows, dimmed. Both
set `aria-busy`. `'error'` shows `error` (default "The list could not be
loaded.") and a Retry button when `onRetry` is given. With no rows the body
shows `emptyState` (default "No items to display"), or "No results match your
filters" and "Clear filters" when a column filter or the global filter is set.

### Pagination

`DataTablePagination` shows "Rows per page", the range ("1–10 of 25", or "No
rows") and Previous and Next. `pageSizes` defaults to `[10, 25, 50, 100]`, and
the current page size is offered even when it is not in the list. In server
mode without `rowCount` it shows "Page {{page}}" and Next follows
`DataTable`'s `hasNextPage`, or else whether the page is full. Its controls are
disabled while loading.

The table always paginates (default page size 10). To show every row, leave
out `DataTablePagination` and set `initialState: { pagination: { pageIndex: 0,
pageSize: Infinity } }`.

### Pinning, resizing, grouping, expansion and virtual rows

- **Pinning** (layout `'fixed'`): `columnPinning.start` and `.end` columns stick
  to their edge while the others scroll, with a border where they meet. In
  layout `'auto'` pinned columns move to their edge but do not stick.
- **Resizing** (layout `'fixed'`): each leaf header has a resize handle. Drag
  it, or double-click it to reset; with focus, the arrow keys change the width
  by 16px (mirrored right to left) within `minSize` and `maxSize`, and Home
  resets it.
- **Grouping**: with `grouping` set, each group row has a toggle showing the
  value and the number of rows; a column's `aggregatedCell` renders its
  aggregate.
- **Expansion**: put `dataTableExpanderColumn<Row>()` (id
  `DATA_TABLE_EXPAND_COLUMN_ID`) in `columns` and set `getRowCanExpand`;
  `renderExpandedRow(row)` draws a full-width detail row under each expanded
  row. Keep `data` stable between renders: new `data` collapses every row.
- **Virtual rows**: `virtualized` with `maxHeight` draws only the rows in and
  near the view, for large pages. `estimateRowHeight` (default 48) sizes the
  rows not yet drawn.

## Tools

Render the tools inside `<DataTable>`; each reads the table from context and
writes table state, so they work the same in client and server mode.

```tsx
<DataTable table={table} label="People">
    <DataTableToolbar>
        <DataTableSearch />
        <DataTableFilters filters={filters} />
        <DataTableColumnSettings />
        <DataTableDensityToggle />
        <DataTableExportButton filename="people" />
    </DataTableToolbar>
    <DataTableSelectionBar>
        {(ids) => <Button onClick={() => remove(ids)}>Delete</Button>}
    </DataTableSelectionBar>
    …
</DataTable>
```

### Toolbar

`DataTableToolbar` is a `div` with `role="toolbar"` (named "Table tools"
unless `aria-label` is given) that lays its children out in a wrapping row.

### Search

`DataTableSearch` binds a search input to the global filter. Typed text is
applied after `debounce` ms (default 300); Enter and clearing apply at once; a
global filter changed elsewhere shows in the input. `placeholder` (default
"Search") is also its accessible name.

### Filters

`DataTableFilters` takes `filters: DataTableFilter[]` and shows a chip per
filter that is `pinned` or has an entry in `columnFilters`; the others are
offered under "Filter". A chip opens a popover with the control for its kind:
text (with a "Match" select when it has more than one operator), number range,
date range, options (checkboxes when `multiple`, radios otherwise, searchable
past eight options), boolean, or the filter's own `Control` for `custom`.
Built-in controls edit a draft that reaches the table on Apply or Enter;
Reset and the chip's clear button remove its entry. Entries the caller keeps
under other ids are left alone, except by "Clear filters", which calls
`table.resetColumnFilters(true)`. In client mode a filter id must be a column
id; in server mode read `columnFilters` and parse each value with
`parseDataTableFilterValue`.

`summarizeDataTableFilter(filter, value)` gives the chip text for a value.

### Column settings and density

`DataTableColumnSettings` (`label`, default "Columns") lists the leaf columns
in table order (pinned to start, unpinned, pinned to end) with a visibility
checkbox and move up/down buttons. A pinned column shows "Pinned" instead of
the move buttons; an unpinned column moves past its unpinned neighbour.
At least one column stays visible. Columns with `enableHiding: false` and the
id `select`, `expand` or `actions` are not listed and keep their place.
"Reset" restores the initial visibility and order.

`DataTableDensityToggle` sets the density through `useDataTableView()`.

### Selection and row actions

Put `dataTableSelectionColumn<Row>()` first in `columns` for a checkbox column
(id `DATA_TABLE_SELECT_COLUMN_ID`): the header checkbox selects the page,
Shift-click selects a range. `DataTableSelectionBar` shows the selected count,
"Clear selection" and its children (a function gets the selected row ids).
Given `totalMatching` and `onAllMatchingChange`, it offers "Select all
{{total}}" once the whole page is selected; `allMatching` is the caller's, and
any change to the selection by hand sets it back to false.

`DataTableRowActions` is a "more" button whose menu holds the
`DropdownMenuItem` children; use it in an `actions` display column.

### Export

`dataTableToCsv(table, { rows, formatValue, delimiter })` writes the visible
data columns in display order as RFC 4180 CSV, guarding against spreadsheet
formulas. `rows` is `'all'` (filtered and sorted, before pagination; in server
mode the loaded page), `'page'` or `'selected'`. `downloadDataTableCsv(table,
filename, options)` downloads it as UTF-8 with a BOM, and
`DataTableExportButton` (`filename`, and `rows`, `formatValue` and
`delimiter` as above) does that for the table in context.

### Saved views

`getDataTableViewState(table)` captures sorting, column filters, the global
filter, column visibility, order, pinning and sizing, grouping and page size
as a versioned, JSON-safe object. Store it as JSON and read it back with
`parseDataTableViewState(json)` (undefined when invalid). Start a table on a
view with `initialState: dataTableViewInitialState(view)`, or switch to one
with `applyDataTableViewState(table, view)`, which resets the slices the view
leaves out and goes to the first page. Row selection, expansion and the page
index are never saved.
