import {
    flexRender,
    type Cell,
    type Header,
    type RowData,
} from '@tanstack/react-table'
import type { DataTableFeatures } from '../features'

/*
 * What `<FlexRender>` does. Its declared return type includes `bigint`, which
 * React 18's types do not accept from a component.
 */

export const renderCell = <TData extends RowData>(
    cell: Cell<DataTableFeatures, TData>
) => {
    const definition = cell.column.columnDef
    if (cell.getIsAggregated()) {
        return flexRender(
            definition.aggregatedCell ?? definition.cell,
            cell.getContext()
        )
    }
    if (cell.getIsPlaceholder()) return null
    return flexRender(definition.cell, cell.getContext())
}

export const renderHeader = <TData extends RowData>(
    header: Header<DataTableFeatures, TData, unknown>
) => flexRender(header.column.columnDef.header, header.getContext())

export const renderFooter = <TData extends RowData>(
    header: Header<DataTableFeatures, TData, unknown>
) => flexRender(header.column.columnDef.footer, header.getContext())
