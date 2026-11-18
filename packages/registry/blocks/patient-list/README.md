# Patient List

A list of the tracked entities in one program and one organisation unit, one
page per request to `tracker/trackedEntities`, shown in the `data-table` block
in server mode. Sorting, filters and paging go to the server.

Nothing is read from program metadata. The block never requests programs,
attributes or option sets: you write the columns, how each cell is formatted,
and the filters, and each filter says which tracker query parameters it sends.

```tsx
import {
    PatientList,
    attributeColumn,
    attributeTextFilter,
    enrollmentStatusFilter,
    fieldColumn,
    usePatientList,
} from '@/components/patient-list'

const columns = [
    attributeColumn('w75KJ2mc4zz', { header: 'First name' }),
    attributeColumn('zDhUuAYrxNC', { header: 'Last name' }),
    fieldColumn('enrolledAt', {
        header: 'Enrolled',
        format: (value) => (value ? value.slice(0, 10) : ''),
    }),
]
const filters = [
    attributeTextFilter({
        attribute: 'w75KJ2mc4zz',
        label: 'First name',
        pinned: true,
    }),
    enrollmentStatusFilter({ pinned: true }),
]

export function ChildProgrammeList() {
    const list = usePatientList({
        program: 'IpHINAT79UW',
        orgUnit: 'DiszpKrYNg8',
        columns,
        filters,
        initialState: { pagination: { pageIndex: 0, pageSize: 15 } },
    })
    return (
        <PatientList list={list} onRowOpen={(row) => open(row.trackedEntity)} />
    )
}
```

Keep `columns` and `filters` stable: define them outside the component or in
a `useMemo`. `usePatientList` takes every `useDataTable` option except `data`,
`mode`, `getRowId` and `rowCount`. It keeps sorting, column filters and
pagination itself, started from `initialState` (15 rows a page by default),
unless you control one by passing both `state.<slice>` and its
`on…Change`. A new sort or filter, a new program or a new organisation unit
starts again from the first page, and the selection is cleared when the
program or organisation unit changes. `orgUnitMode` defaults to `SELECTED`.

## Columns

`attributeColumn(uid, options)` shows one attribute's stored value;
`fieldColumn(field, options)` shows `createdAt`, `updatedAt`, `enrolledAt`,
`occurredAt`, `enrollmentStatus`, `orgUnit`, `inactive` or `trackedEntity`.
The column id is the tracker `order` field. Attribute columns and `createdAt`,
`updatedAt`, `enrolledAt`, `inactive` and `trackedEntity` sort on the server
by default; set `sortable` to change that.

Values are shown as stored. Format them in `format`, for example with the
`dhis2-value-display` block:

```tsx
import {
    formatDhis2Value,
    parseDhis2Calendar,
} from '@/components/dhis2-value-display'

const calendar = parseDhis2Calendar('ethiopian') // from systemInfo.calendar

const birthDate = attributeColumn('iESIqZ0R0R0', {
    header: 'Date of birth',
    format: (value) =>
        formatDhis2Value(value, { valueType: 'DATE' }, { calendar }),
})
```

For anything else (row actions, a value built from several attributes) write
a column with `patientListColumn`, the data table column helper for
`PatientListRow`.

## Filters

Each factory returns a data table filter with a `toQuery` that turns the
applied value into tracker query parameters. Values are escaped (`/`, `:` and
`,` with a leading `/`).

| Filter                                              | Sends                                                              |
| --------------------------------------------------- | ------------------------------------------------------------------ |
| `attributeTextFilter`: contains, equals, startsWith | `filter=A:like:v`, `A:eq:v`, `A:sw:v`                              |
| `attributeTextFilter`: empty, notEmpty              | `filter=A:null`, `A:!null`                                         |
| `attributeNumberFilter`, `attributeDateFilter`      | `filter=A:ge:from:le:to`, or the one bound that is set             |
| `attributeOptionsFilter`                            | `filter=A:eq:v` for one value, `A:in:v1;v2` for several            |
| `attributeBooleanFilter`                            | `filter=A:eq:true` or `A:eq:false`                                 |
| `enrollmentStatusFilter`                            | `enrollmentStatus` (Active, Completed, Cancelled)                  |
| `enrollmentDateFilter` (`enrolledAt`, `occurredAt`) | `enrollmentEnrolledAfter/Before`, `enrollmentOccurredAfter/Before` |

Text filters offer `contains` unless you pass `operators`. `baseQuery` is sent
with every request, before the filters the user applies:
`baseQuery: { enrollmentStatus: 'ACTIVE' }`.

A custom filter is a data table `custom` filter with a `toQuery`:

```tsx
import type { PatientListFilter } from '@/components/patient-list'

const followUp: PatientListFilter = {
    id: 'followUp',
    kind: 'custom',
    label: 'Follow-up',
    Control: ({ value, onChange }) => (
        <button
            type="button"
            onClick={() => onChange(value ? undefined : 'true')}
        >
            {value ? 'Show everyone' : 'Only marked for follow-up'}
        </button>
    ),
    summarize: () => 'Marked for follow-up',
    toQuery: (value) =>
        value.kind === 'custom' ? { params: { followUp: value.value } } : {},
}
```

`params` cannot replace a parameter the block sets itself.

## Your own layout

Children replace the default layout (filters, column settings, rows and
pagination). Use the data table parts; there is no global search, because
the tracker API has none.

```tsx
<PatientList list={list}>
    <DataTableToolbar>
        <DataTableFilters filters={list.filters} />
        <DataTableDensityToggle />
    </DataTableToolbar>
    <DataTableContent
        stickyHeader
        maxHeight={600}
        onRowOpen={(row) => open(row.original.trackedEntity)}
    />
    <DataTablePagination pageSizes={PATIENT_LIST_PAGE_SIZES} />
</PatientList>
```

## The request alone

`usePatientListQuery(query)` returns the TanStack Query result for one page,
without a table:

```ts
const { data } = usePatientListQuery({
    program: 'IpHINAT79UW',
    orgUnit: 'DiszpKrYNg8',
    page: 1,
    pageSize: 5,
    order: ['enrolledAt:desc'],
})
// data?.rows, data?.hasNextPage
```

Pages stay fresh for 20 seconds, keyed by server URL, API version and the
request parameters. After a change that affects the list, such as an
enrollment, invalidate them all:

```ts
queryClient.invalidateQueries({ queryKey: patientListKeys.all })
```

## Not included

No event or stage lists, saved views, organisation unit or user names, or
total counts. Attribute values are not looked up in option sets; format them
yourself.

## DHIS2 versions

Works with 2.41 and later; the API version comes from app-runtime's
`useConfig`. On 2.41 the list is under `instances` and there is no
`pager.nextPage`, so a full page is taken to mean there is another; the
enrollment status is sent as `programStatus`. The `empty` and `notEmpty`
text operators (`null`, `!null`) need 2.42 or later; leave them out of
`operators` on 2.41.
