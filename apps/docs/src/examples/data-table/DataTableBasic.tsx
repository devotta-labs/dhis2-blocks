import {
    createDataTableColumnHelper,
    DataTable,
    DataTableContent,
    DataTablePagination,
    useDataTable,
} from '@/components/data-table'
import { facilities, type Facility } from './facilities'

const column = createDataTableColumnHelper<Facility>()

const columns = column.columns([
    column.accessor('name', { header: 'Name' }),
    column.accessor('district', { header: 'District' }),
    column.accessor('type', { header: 'Type' }),
    column.accessor('beds', { header: 'Beds', meta: { align: 'end' } }),
])

/** Facilities that sort by any column header, ten to a page. */
const DataTableBasic = () => {
    const table = useDataTable({
        data: facilities,
        columns,
        getRowId: (facility) => facility.id,
        initialState: { pagination: { pageIndex: 0, pageSize: 10 } },
    })

    return (
        <DataTable table={table} label="Facilities">
            <DataTableContent />
            <DataTablePagination />
        </DataTable>
    )
}

export default DataTableBasic
