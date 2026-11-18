import {
    createDataTableColumnHelper,
    DataTable,
    DataTableContent,
    useDataTable,
} from '@/components/data-table'
import { facilities, type Facility } from './facilities'

const ROW_COUNT = 10_000

const rows: Facility[] = []
for (let index = 0; index < ROW_COUNT; index++) {
    const facility = facilities[index % facilities.length]
    rows.push({
        ...facility,
        id: `row-${index + 1}`,
        name: `${facility.name} ${index + 1}`,
    })
}

const column = createDataTableColumnHelper<Facility>()

const columns = column.columns([
    column.accessor('name', { header: 'Name' }),
    column.accessor('district', { header: 'District' }),
    column.accessor('type', { header: 'Type' }),
    column.accessor('beds', { header: 'Beds', meta: { align: 'end' } }),
    column.accessor('reportingRate', {
        header: 'Reporting',
        meta: { align: 'end' },
        cell: ({ getValue }) => `${getValue()}%`,
    }),
])

/** Ten thousand rows in one scrolling body that draws only what is in view. */
const DataTableVirtual = () => {
    const table = useDataTable({
        data: rows,
        columns,
        getRowId: (facility) => facility.id,
        // An endless page: every row, no pagination.
        initialState: { pagination: { pageIndex: 0, pageSize: Infinity } },
    })

    return (
        <DataTable table={table} label="Facilities">
            <DataTableContent virtualized stickyHeader maxHeight={420} />
        </DataTable>
    )
}

export default DataTableVirtual
