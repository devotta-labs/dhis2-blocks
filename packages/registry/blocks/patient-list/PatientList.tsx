import i18n from '@dhis2/d2-i18n'
import {
    DataTable,
    DataTableColumnSettings,
    DataTableContent,
    DataTableFilters,
    DataTablePagination,
    DataTableToolbar,
    type DataTableProps,
    type DataTableRow,
} from '@/components/data-table'
import type { ReactNode } from 'react'
import { PatientListRequestError } from './api/requestErrors'
import type { PatientListRow } from './types'
import {
    PATIENT_LIST_PAGE_SIZES,
    type PatientListController,
} from './usePatientList'

export interface PatientListProps extends Omit<
    DataTableProps<PatientListRow>,
    | 'table'
    | 'label'
    | 'status'
    | 'error'
    | 'onRetry'
    | 'hasNextPage'
    | 'children'
> {
    list: PatientListController
    /** Accessible name. Default: "Patient list". */
    label?: string
    /** Used by the default layout. With your own children, pass it to DataTableContent. */
    onRowOpen?: (row: PatientListRow) => void
    /** Replaces the default layout. */
    children?: ReactNode
}

/** The server's message for a failed request; otherwise the table's own text. */
const errorMessage = (error: Error | null) =>
    error instanceof PatientListRequestError && error.serverMessage
        ? error.serverMessage
        : undefined

/** The list in a data table: filters, column settings, rows and pagination. */
export const PatientList = ({
    list,
    label,
    onRowOpen,
    children,
    ...rest
}: PatientListProps) => (
    <DataTable
        table={list.table}
        label={label ?? i18n.t('Patient list')}
        status={list.status}
        error={errorMessage(list.error)}
        onRetry={list.refetch}
        hasNextPage={list.hasNextPage}
        data-block="patient-list"
        {...rest}
    >
        {children ?? (
            <>
                <DataTableToolbar>
                    {list.filters.length > 0 && (
                        <DataTableFilters filters={list.filters} />
                    )}
                    <DataTableColumnSettings className="ms-auto" />
                </DataTableToolbar>
                <DataTableContent
                    onRowOpen={
                        onRowOpen &&
                        ((row: DataTableRow<PatientListRow>) =>
                            onRowOpen(row.original))
                    }
                />
                <DataTablePagination pageSizes={PATIENT_LIST_PAGE_SIZES} />
            </>
        )}
    </DataTable>
)
