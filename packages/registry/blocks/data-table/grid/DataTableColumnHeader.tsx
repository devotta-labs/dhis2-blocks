import type { Header, RowData } from '@tanstack/react-table'
import { cn } from '@/components/dhis2/ui/cn'
import { TableHead } from '@/components/dhis2/ui/table'
import { dataTableColumnLabel } from '../columnLabel'
import { useDataTableView } from '../context'
import type { DataTableFeatures } from '../features'
import { ColumnMenu } from './ColumnMenu'
import { useDataTableContent } from './contentContext'
import { renderHeader } from './render'
import { ResizeHandle } from './ResizeHandle'
import {
    alignClass,
    columnPlacement,
    headDensityClass,
    isLastDrawnColumn,
} from './sizing'
import { SortIndicator } from './SortIndicator'

const SORT_BUTTON_CLASS =
    'group/sort flex min-h-6 min-w-0 flex-1 cursor-pointer items-center border-0 bg-transparent p-0 text-start text-[inherit] [font-weight:inherit] outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-dhis2-ring'

const justifyClasses = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end',
} as const

const ariaSortBy = { asc: 'ascending', desc: 'descending' } as const

/** Columns that hold controls; in layout 'auto' they take only their content width. */
const utilityIds: readonly string[] = ['select', 'expand', 'actions']

const ariaSortOf = (canSort: boolean, sorted: false | 'asc' | 'desc') => {
    if (!canSort) return undefined
    return sorted === false ? 'none' : ariaSortBy[sorted]
}

/** One `<th>`: sort button, column menu and resize handle. */
export const DataTableColumnHeader = <TData extends RowData>({
    header,
}: {
    header: Header<DataTableFeatures, TData, unknown>
}) => {
    const view = useDataTableView()
    const { columnMenu, stickyHeader } = useDataTableContent()
    const column = header.column
    const meta = column.columnDef.meta
    const fixed = view.layout === 'fixed'
    const canSort = !header.isPlaceholder && column.getCanSort()
    const canResize =
        fixed &&
        !header.isPlaceholder &&
        header.subHeaders.length === 0 &&
        column.getCanResize()
    const sorted = column.getIsSorted()
    const label = dataTableColumnLabel(column)
    const placement = columnPlacement(column, {
        layout: view.layout,
        stickyHeaderCell: stickyHeader,
    })

    return (
        <TableHead
            colSpan={header.colSpan > 1 ? header.colSpan : undefined}
            scope="col"
            aria-sort={ariaSortOf(canSort, sorted)}
            data-slot="data-table-head"
            data-column-id={column.id}
            className={cn(
                fixed && 'relative',
                // The last column's resize handle sits inside the cell.
                canResize && isLastDrawnColumn(column) && 'pe-6',
                !fixed && utilityIds.includes(column.id) && 'w-px',
                stickyHeader && 'sticky top-0 z-20',
                headDensityClass(view.density),
                alignClass(meta),
                placement.className
            )}
            style={placement.style}
        >
            {header.isPlaceholder ? null : (
                <div className="flex min-w-0 items-center gap-1">
                    {canSort ? (
                        <button
                            type="button"
                            data-slot="data-table-sort"
                            className={cn(
                                SORT_BUTTON_CLASS,
                                justifyClasses[meta?.align ?? 'start']
                            )}
                            onClick={column.getToggleSortingHandler()}
                        >
                            <span className="min-w-0">
                                {renderHeader(header)}
                            </span>
                            <SortIndicator sorted={sorted} />
                        </button>
                    ) : (
                        <span className="min-w-0 flex-1">
                            {renderHeader(header)}
                        </span>
                    )}
                    {columnMenu && (
                        <ColumnMenu
                            column={column}
                            label={label}
                            layout={view.layout}
                        />
                    )}
                </div>
            )}
            {canResize && <ResizeHandle header={header} label={label} />}
        </TableHead>
    )
}
