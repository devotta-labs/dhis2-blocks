import type { Column, RowData } from '@tanstack/react-table'
import type { DataTableFeatures } from './features'

/** The plain-text name of a column: `meta.label`, else a string `header`, else its id. */
export const dataTableColumnLabel = <TData extends RowData, TValue>(
    column: Column<DataTableFeatures, TData, TValue>
): string => {
    const { header, meta } = column.columnDef
    if (meta?.label !== undefined) return meta.label
    if (header !== undefined && !(header instanceof Function)) return header
    return column.id
}
