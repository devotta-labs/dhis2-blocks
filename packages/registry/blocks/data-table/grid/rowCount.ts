import type { RowData, Table } from '@tanstack/react-table'
import type { DataTableFeatures } from '../features'

/**
 * Body rows across all pages, or undefined in server mode without
 * `rowCount`. `useDataTable` always passes `manualPagination`, so the
 * render's raw options say which mode the table is in.
 */
export const totalRowCount = <TData extends RowData>(
    table: Table<DataTableFeatures, TData>
): number | undefined =>
    table.options.manualPagination === true &&
    table.options.rowCount === undefined
        ? undefined
        : table.getRowCount()
