import { Button } from '@/components/dhis2/ui/button'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/dhis2/ui/select'
import {
    createDataTableColumnHelper,
    DataTable,
    DataTableContent,
    DataTableFilters,
    DataTablePagination,
    DataTableSearch,
    DataTableToolbar,
    parseDataTableFilterValue,
    useDataTable,
    type DataTableCustomFilterControlProps,
    type DataTableFilter,
} from '@/components/data-table'
import { facilities, type Facility } from './facilities'

const reportingOptions = [
    { value: 'below', label: 'Below 80%' },
    { value: 'above', label: '80% and above' },
]

/** The "Reporting" filter's own control: picking an option applies it. */
const ReportingControl = ({
    value,
    onChange,
}: DataTableCustomFilterControlProps) => (
    <div className="flex flex-col gap-3">
        <Select
            items={reportingOptions}
            value={value ?? null}
            onValueChange={(next) => onChange(next ?? undefined)}
        >
            <SelectTrigger aria-label="Reporting rate">
                <SelectValue placeholder="Any rate" />
            </SelectTrigger>
            <SelectContent>
                {reportingOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                        {option.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
        <Button
            type="button"
            variant="secondary"
            size="sm"
            className="self-start"
            onClick={() => onChange(undefined)}
        >
            Reset
        </Button>
    </div>
)

const filters: DataTableFilter[] = [
    {
        id: 'name',
        kind: 'text',
        label: 'Name',
        pinned: true,
        operators: ['contains', 'startsWith', 'equals'],
    },
    {
        id: 'type',
        kind: 'options',
        label: 'Type',
        pinned: true,
        multiple: true,
        options: ['Hospital', 'CHC', 'CHP', 'MCHP', 'Clinic'].map((type) => ({
            value: type,
            label: type,
        })),
    },
    {
        id: 'ownership',
        kind: 'options',
        label: 'Ownership',
        options: [
            { value: 'Public', label: 'Public' },
            { value: 'Private', label: 'Private' },
            { value: 'Mission', label: 'Mission' },
        ],
    },
    { id: 'beds', kind: 'number', label: 'Beds', min: 0 },
    { id: 'openedOn', kind: 'date', label: 'Opened' },
    {
        id: 'active',
        kind: 'boolean',
        label: 'Status',
        trueLabel: 'Active',
        falseLabel: 'Inactive',
    },
    {
        id: 'reportingRate',
        kind: 'custom',
        label: 'Reporting',
        Control: ReportingControl,
        summarize: (value) =>
            reportingOptions.find((option) => option.value === value)?.label ??
            value,
    },
]

const column = createDataTableColumnHelper<Facility>()

const columns = column.columns([
    column.accessor('name', { header: 'Name' }),
    column.accessor('district', { header: 'District' }),
    column.accessor('type', { header: 'Type' }),
    column.accessor('ownership', { header: 'Ownership' }),
    column.accessor('beds', { header: 'Beds', meta: { align: 'end' } }),
    column.accessor('openedOn', {
        header: 'Opened',
        meta: { nowrap: true },
    }),
    column.accessor('reportingRate', {
        header: 'Reporting',
        meta: { align: 'end' },
        cell: ({ getValue }) => `${getValue()}%`,
        // The block's filter passes every custom value; this column reads it.
        filterFn: (row, columnId, filterValue) => {
            const value = parseDataTableFilterValue({
                id: columnId,
                value: filterValue,
            })
            if (value?.kind !== 'custom') return true
            const rate = row.original.reportingRate
            return value.value === 'below' ? rate < 80 : rate >= 80
        },
    }),
    column.accessor('active', {
        header: 'Status',
        cell: ({ getValue }) => (getValue() ? 'Active' : 'Inactive'),
    }),
])

/** Search, pinned filters and more under "Filter", one of them custom. */
const DataTableFiltering = () => {
    const table = useDataTable({
        data: facilities,
        columns,
        getRowId: (facility) => facility.id,
    })

    return (
        <DataTable table={table} label="Facilities">
            <DataTableToolbar>
                <DataTableSearch placeholder="Search facilities" />
                <DataTableFilters filters={filters} />
            </DataTableToolbar>
            <DataTableContent />
            <DataTablePagination />
        </DataTable>
    )
}

export default DataTableFiltering
