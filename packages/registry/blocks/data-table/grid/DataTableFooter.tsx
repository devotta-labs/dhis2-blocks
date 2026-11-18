import type { RowData, Table } from '@tanstack/react-table'
import { cn } from '@/components/dhis2/ui/cn'
import { TableCell, TableFooter, TableRow } from '@/components/dhis2/ui/table'
import { useDataTableView } from '../context'
import type { DataTableFeatures } from '../features'
import { useDataTableInstance } from '../tableHook'
import { renderFooter } from './render'
import { totalRowCount } from './rowCount'
import { alignClass, cellDensityClass, columnPlacement } from './sizing'

/** Whether a visible leaf column defines `footer`. */
export const hasColumnFooter = <TData extends RowData>(
    table: Table<DataTableFeatures, TData>
) =>
    table
        .getVisibleLeafColumns()
        .some((column) => column.columnDef.footer !== undefined)

/** One row per footer group, rendering each column's `footer`. */
export const DataTableFooter = ({ className }: { className?: string }) => {
    const table = useDataTableInstance()
    const { layout, density } = useDataTableView()
    const headerRows = table.getHeaderGroups().length
    const bodyRows = totalRowCount(table)
    return (
        <TableFooter data-slot="data-table-footer" className={className}>
            {table.getFooterGroups().map((group, index) => (
                <TableRow
                    key={group.id}
                    aria-rowindex={
                        bodyRows === undefined
                            ? undefined
                            : headerRows + bodyRows + index + 1
                    }
                >
                    {group.headers.map((header) => {
                        const column = header.column
                        const placement = columnPlacement(column, { layout })
                        return (
                            <TableCell
                                key={header.id}
                                colSpan={
                                    header.colSpan > 1
                                        ? header.colSpan
                                        : undefined
                                }
                                data-column-id={column.id}
                                className={cn(
                                    'group-hover/table-row:bg-dhis2-background group-active/table-row:bg-dhis2-background',
                                    cellDensityClass(density),
                                    alignClass(column.columnDef.meta),
                                    placement.className
                                )}
                                style={placement.style}
                            >
                                {header.isPlaceholder
                                    ? null
                                    : renderFooter(header)}
                            </TableCell>
                        )
                    })}
                </TableRow>
            ))}
        </TableFooter>
    )
}
