import {
    createDataTableColumnHelper,
    DataTable,
    DataTableContent,
    dataTableExpanderColumn,
    DataTablePagination,
    useDataTable,
} from '@/components/data-table'
import { useState } from 'react'
import { facilities, type Facility } from './facilities'

const column = createDataTableColumnHelper<Facility>()

const columns = column.columns([
    dataTableExpanderColumn<Facility>(),
    column.accessor('name', { header: 'Name' }),
    column.accessor('district', { header: 'District' }),
    column.accessor('type', { header: 'Type' }),
])

const FacilityDetails = ({ facility }: { facility: Facility }) => {
    const details = [
        { term: 'Ownership', value: facility.ownership },
        { term: 'Beds', value: String(facility.beds) },
        { term: 'Opened', value: facility.openedOn },
        { term: 'Reporting rate', value: `${facility.reportingRate}%` },
        { term: 'Status', value: facility.active ? 'Active' : 'Inactive' },
    ]
    return (
        <dl className="m-0 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1 py-1 text-sm">
            {details.map(({ term, value }) => (
                <div key={term} className="contents">
                    <dt className="text-dhis2-subtle-foreground">{term}</dt>
                    <dd className="m-0">{value}</dd>
                </div>
            ))}
        </dl>
    )
}

/** Rows that expand to the facility's other fields, and open on click. */
const DataTableRowDetail = () => {
    const [opened, setOpened] = useState<string>()
    const table = useDataTable({
        data: facilities,
        columns,
        getRowId: (facility) => facility.id,
        getRowCanExpand: () => true,
    })

    return (
        <div className="flex flex-col gap-2">
            <DataTable table={table} label="Facilities">
                <DataTableContent<Facility>
                    renderExpandedRow={(row) => (
                        <FacilityDetails facility={row.original} />
                    )}
                    onRowOpen={(row) => setOpened(row.original.name)}
                    rowOpenLabel={(row) => `Open ${row.original.name}`}
                />
                <DataTablePagination />
            </DataTable>
            <p role="status" className="m-0 min-h-5 text-sm">
                {opened === undefined ? '' : `Opened ${opened}`}
            </p>
        </div>
    )
}

export default DataTableRowDetail
