import { Badge } from '@/components/dhis2/ui/badge'
import { Button } from '@/components/dhis2/ui/button'
import { DropdownMenuItem } from '@/components/dhis2/ui/dropdown-menu'
import {
    createDataTableColumnHelper,
    DataTable,
    DataTableColumnSettings,
    DataTableContent,
    DataTableDensityToggle,
    DataTableExportButton,
    DataTablePagination,
    DataTableRowActions,
    DataTableSelectionBar,
    DataTableToolbar,
    dataTableSelectionColumn,
    useDataTable,
} from '@/components/data-table'
import { useCallback, useMemo, useState } from 'react'
import { facilities, type Facility } from './facilities'

const rateTone = (rate: number) => {
    if (rate >= 90) return 'bg-dhis2-success-fill text-dhis2-success-strong'
    if (rate >= 80) return 'bg-dhis2-warning-fill text-dhis2-warning-strong'
    return 'bg-dhis2-destructive-fill text-dhis2-destructive-strong'
}

const withInactive = (rows: Facility[], ids: readonly string[]) =>
    rows.map((facility) =>
        ids.includes(facility.id) ? { ...facility, active: false } : facility
    )

interface FacilityActions {
    open: (facility: Facility) => void
    markInactive: (ids: readonly string[]) => void
}

const column = createDataTableColumnHelper<Facility>()

const facilityColumns = ({ open, markInactive }: FacilityActions) =>
    column.columns([
        dataTableSelectionColumn<Facility>(),
        column.accessor('name', { header: 'Name', size: 260 }),
        column.accessor('district', { header: 'District', size: 140 }),
        column.accessor('type', { header: 'Type', size: 110 }),
        column.accessor('ownership', { header: 'Ownership', size: 130 }),
        column.accessor('reportingRate', {
            header: 'Reporting',
            size: 130,
            cell: ({ getValue }) => (
                <Badge className={rateTone(getValue())}>{getValue()}%</Badge>
            ),
        }),
        column.accessor('active', {
            header: 'Status',
            size: 110,
            cell: ({ getValue }) => (getValue() ? 'Active' : 'Inactive'),
        }),
        column.display({
            id: 'actions',
            size: 56,
            enableHiding: false,
            enableResizing: false,
            meta: { label: 'Actions' },
            header: () => <span className="sr-only">Actions</span>,
            cell: ({ row }) => (
                <DataTableRowActions label={`Actions for ${row.original.name}`}>
                    <DropdownMenuItem onClick={() => open(row.original)}>
                        Open
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => markInactive([row.id])}>
                        Mark inactive
                    </DropdownMenuItem>
                </DataTableRowActions>
            ),
        }),
    ])

/**
 * Checkboxes with a bulk action, a menu per row, and the column, density and
 * download tools. Columns are pinned, resizable and formatted.
 */
const DataTableSelection = () => {
    const [rows, setRows] = useState(facilities)
    const [message, setMessage] = useState('')

    const markInactive = useCallback((ids: readonly string[]) => {
        setRows((current) => withInactive(current, ids))
        setMessage(
            ids.length === 1
                ? '1 facility marked inactive'
                : `${ids.length} facilities marked inactive`
        )
    }, [])

    const columns = useMemo(
        () =>
            facilityColumns({
                open: (facility) => setMessage(`Opened ${facility.name}`),
                markInactive,
            }),
        [markInactive]
    )

    const table = useDataTable({
        data: rows,
        columns,
        getRowId: (facility) => facility.id,
        // Marking a row inactive gives new data; stay on the same page.
        autoResetPageIndex: false,
        initialState: {
            columnPinning: { start: ['select', 'name'], end: ['actions'] },
        },
    })

    return (
        <div className="flex flex-col gap-2">
            <DataTable table={table} label="Facilities" layout="fixed">
                <DataTableToolbar>
                    <DataTableColumnSettings />
                    <DataTableDensityToggle />
                    <DataTableExportButton
                        filename="facilities"
                        formatValue={(cell) => {
                            const value = cell.getValue()
                            if (cell.column.id === 'active') {
                                return value ? 'Active' : 'Inactive'
                            }
                            return String(value ?? '')
                        }}
                    />
                </DataTableToolbar>
                <DataTableSelectionBar>
                    {(ids) => (
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                                markInactive(ids)
                                table.resetRowSelection(true)
                            }}
                        >
                            Mark inactive
                        </Button>
                    )}
                </DataTableSelectionBar>
                <DataTableContent />
                <DataTablePagination />
            </DataTable>
            <p role="status" className="m-0 min-h-5 text-sm">
                {message}
            </p>
        </div>
    )
}

export default DataTableSelection
