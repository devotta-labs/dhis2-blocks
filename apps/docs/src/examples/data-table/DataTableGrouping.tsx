import {
    createDataTableColumnHelper,
    DataTable,
    DataTableContent,
    useDataTable,
} from '@/components/data-table'
import { facilities, type Facility } from './facilities'

const column = createDataTableColumnHelper<Facility>()

const columns = column.columns([
    column.accessor('district', { header: 'District', enableGrouping: true }),
    column.accessor('type', { header: 'Type', enableGrouping: true }),
    column.accessor('ownership', { header: 'Ownership', enableGrouping: true }),
    column.accessor('name', {
        header: 'Facility',
        aggregationFn: 'count',
        // `getValue` is typed as the column's value, a name; 'count' gives a number.
        aggregatedCell: ({ getValue }) => {
            const count = Number(getValue())
            return count === 1 ? '1 facility' : `${count} facilities`
        },
    }),
    column.accessor('beds', {
        header: 'Beds',
        meta: { align: 'end' },
        aggregationFn: 'sum',
        aggregatedCell: ({ getValue }) => getValue().toLocaleString(),
    }),
    column.accessor('reportingRate', {
        header: 'Reporting',
        meta: { align: 'end' },
        cell: ({ getValue }) => `${getValue()}%`,
        aggregationFn: 'mean',
        aggregatedCell: ({ getValue }) => `${Math.round(getValue())}% average`,
    }),
])

/**
 * Facilities grouped by district with a count, total beds and the average
 * reporting rate per group. A column's menu changes the grouping.
 */
const DataTableGrouping = () => {
    const table = useDataTable({
        data: facilities,
        columns,
        getRowId: (facility) => facility.id,
        initialState: {
            grouping: ['district'],
            // An endless page: every group, no pagination.
            pagination: { pageIndex: 0, pageSize: Infinity },
        },
    })

    return (
        <DataTable table={table} label="Facilities by district">
            <DataTableContent columnMenu />
        </DataTable>
    )
}

export default DataTableGrouping
