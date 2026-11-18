import { IconChevronDown16, IconChevronRight16 } from '@dhis2/ui-icons'
import type { Cell, Row, RowData } from '@tanstack/react-table'
import { cn } from '@/components/dhis2/ui/cn'
import { TableCell } from '@/components/dhis2/ui/table'
import type { ReactNode } from 'react'
import { useDataTableView } from '../context'
import type { DataTableFeatures } from '../features'
import { renderCell } from './render'
import { alignClass, cellDensityClass, columnPlacement } from './sizing'

const GroupToggle = <TData extends RowData>({
    cell,
    row,
}: {
    cell: Cell<DataTableFeatures, TData>
    row: Row<DataTableFeatures, TData>
}) => {
    const expanded = row.getIsExpanded()
    // getLeafRows() also returns the groups nested in this one.
    const leafCount = row
        .getLeafRows()
        .filter((leaf) => !leaf.getIsGrouped()).length
    return (
        <button
            type="button"
            data-slot="data-table-group-toggle"
            aria-expanded={expanded}
            onClick={row.getToggleExpandedHandler()}
            className="inline-flex max-w-full cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-start text-[inherit] [font-weight:inherit] outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-dhis2-ring"
            style={{ marginInlineStart: `${row.depth * 16}px` }}
        >
            <span
                aria-hidden="true"
                className={cn('flex shrink-0', !expanded && 'rtl:rotate-180')}
            >
                {expanded ? <IconChevronDown16 /> : <IconChevronRight16 />}
            </span>
            <span className="min-w-0">{renderCell(cell)}</span>
            <span>{` (${leafCount})`}</span>
        </button>
    )
}

const DataTableBodyCell = <TData extends RowData>({
    cell,
    row,
    leading,
}: {
    cell: Cell<DataTableFeatures, TData>
    row: Row<DataTableFeatures, TData>
    leading: ReactNode
}) => {
    const { layout, density } = useDataTableView()
    const column = cell.column
    const meta = column.columnDef.meta
    const nowrap = meta?.nowrap === true
    const placement = columnPlacement(column, { layout })
    const rowSpan = cell.getRowSpan()
    const colSpan = cell.getColSpan()
    return (
        <TableCell
            data-slot="data-table-cell"
            data-column-id={column.id}
            rowSpan={rowSpan > 1 ? rowSpan : undefined}
            colSpan={colSpan > 1 ? colSpan : undefined}
            className={cn(
                cellDensityClass(density),
                alignClass(meta),
                nowrap && 'whitespace-nowrap',
                nowrap && layout === 'fixed' && 'overflow-hidden text-ellipsis',
                placement.className
            )}
            style={placement.style}
        >
            {leading}
            {cell.getIsGrouped() ? (
                <GroupToggle cell={cell} row={row} />
            ) : (
                renderCell(cell)
            )}
        </TableCell>
    )
}

/**
 * The cells of one row. `leading` goes into the first cell that is drawn
 * (a cell covered by a span from the row above is not).
 */
export const DataTableCells = <TData extends RowData>({
    row,
    leading,
}: {
    row: Row<DataTableFeatures, TData>
    leading: ReactNode
}) =>
    row
        .getVisibleCells()
        .filter((cell) => !cell.getIsCovered())
        .map((cell, index) => (
            <DataTableBodyCell
                key={cell.id}
                cell={cell}
                row={row}
                leading={index === 0 ? leading : null}
            />
        ))
