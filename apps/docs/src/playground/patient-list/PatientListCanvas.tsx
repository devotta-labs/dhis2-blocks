import { useState } from 'react'
import { Button } from '@/components/dhis2/ui/button'
import {
    DataTableColumnSettings,
    DataTableContent,
    DataTableDensityToggle,
    DataTableFilters,
    DataTablePagination,
    DataTableSelectionBar,
    DataTableToolbar,
    dataTableSelectionColumn,
    type DataTableState,
} from '@/components/data-table'
import {
    PATIENT_LIST_PAGE_SIZES,
    PatientList,
    attributeColumn,
    attributeOptionsFilter,
    attributeTextFilter,
    enrollmentDateFilter,
    enrollmentStatusFilter,
    fieldColumn,
    usePatientList,
    type PatientListRow,
} from '@/components/patient-list'
import type { LabView } from './labData'

// The Child Programme's first name, last name and gender.
const FIRST_NAME = 'w75KJ2mc4zz'
const LAST_NAME = 'zDhUuAYrxNC'
const GENDER = 'cejWyOfXge6'

const STATUS_LABELS = {
    ACTIVE: 'Active',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
} as const

const columns = [
    attributeColumn(FIRST_NAME, { header: 'First name' }),
    attributeColumn(LAST_NAME, { header: 'Last name' }),
    attributeColumn(GENDER, { header: 'Gender' }),
    fieldColumn('enrolledAt', {
        header: 'Enrolled',
        nowrap: true,
        format: (value) => value?.slice(0, 10),
    }),
    fieldColumn('enrollmentStatus', {
        header: 'Status',
        format: (_value, row) =>
            row.enrollment && STATUS_LABELS[row.enrollment.status],
    }),
]

const selectableColumns = [
    dataTableSelectionColumn<PatientListRow>(),
    ...columns,
]

const filters = [
    attributeTextFilter({
        attribute: FIRST_NAME,
        label: 'First name',
        pinned: true,
        operators: ['contains', 'startsWith', 'equals'],
    }),
    attributeTextFilter({ attribute: LAST_NAME, label: 'Last name' }),
    attributeOptionsFilter({
        attribute: GENDER,
        label: 'Gender',
        options: [
            { value: 'Female', label: 'Female' },
            { value: 'Male', label: 'Male' },
        ],
    }),
    enrollmentStatusFilter({ pinned: true }),
    enrollmentDateFilter({ field: 'enrolledAt', label: 'Enrolled' }),
]

interface Props {
    view: LabView
    program: string
    orgUnit: string
    note: (entry: string) => void
}

/** Mount it again (change its `key`) for a new first page size. */
export const PatientListCanvas = ({ view, program, orgUnit, note }: Props) => {
    // Controlled, so each change of page shows in the log.
    const [pagination, setPagination] = useState<DataTableState['pagination']>({
        pageIndex: 0,
        pageSize: view.pageSize,
    })
    const list = usePatientList({
        program,
        orgUnit,
        columns: view.selection ? selectableColumns : columns,
        filters,
        state: { pagination },
        onPaginationChange: (updater) => {
            const next =
                updater instanceof Function ? updater(pagination) : updater
            setPagination(next)
            note(`onPaginationChange(${JSON.stringify(next)})`)
        },
    })
    const toolbar = view.filters || view.columnSettings || view.density

    return (
        <PatientList
            list={list}
            onDensityChange={(density) => note(`onDensityChange("${density}")`)}
        >
            {toolbar && (
                <DataTableToolbar>
                    {view.filters && (
                        <DataTableFilters filters={list.filters} />
                    )}
                    {(view.columnSettings || view.density) && (
                        <div className="ms-auto flex items-center gap-2">
                            {view.density && <DataTableDensityToggle />}
                            {view.columnSettings && <DataTableColumnSettings />}
                        </div>
                    )}
                </DataTableToolbar>
            )}
            {view.selection && (
                <DataTableSelectionBar>
                    {(ids) => (
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                                note(`Follow up(${JSON.stringify(ids)})`)
                            }
                        >
                            Follow up
                        </Button>
                    )}
                </DataTableSelectionBar>
            )}
            <DataTableContent<PatientListRow>
                onRowOpen={
                    view.clickable
                        ? (row) =>
                              note(`onRowOpen("${row.original.trackedEntity}")`)
                        : undefined
                }
            />
            {view.pagination && (
                <DataTablePagination pageSizes={PATIENT_LIST_PAGE_SIZES} />
            )}
        </PatientList>
    )
}
