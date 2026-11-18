import type { RowData, Table as CoreTable } from '@tanstack/react-table'
import { cn } from '@/components/dhis2/ui/cn'
import { Table } from '@/components/dhis2/ui/table'
import { useState, type CSSProperties, type ReactNode } from 'react'
import { useDataTableView } from '../context'
import type { DataTableFeatures } from '../features'
import { useDataTableInstance, type DataTableRowData } from '../tableHook'
import {
    DataTableContentContext,
    DEFAULT_ROW_HEIGHT,
    type DataTableContentContextValue,
} from './contentContext'
import { DataTableBody, type DataTableBodyProps } from './DataTableBody'
import { DataTableFooter, hasColumnFooter } from './DataTableFooter'
import { DataTableHeader } from './DataTableHeader'
import { totalRowCount } from './rowCount'
import { drawnColumns } from './sizing'

export interface DataTableContentProps<
    TData,
> extends DataTableBodyProps<TData> {
    /** Replaces the default `<DataTableHeader /><DataTableBody /><DataTableFooter />`. */
    children?: ReactNode
    className?: string
    /** Show the per-column menu button in headers. Default false. */
    columnMenu?: boolean
    /** Keep the header visible while the body scrolls. Needs `maxHeight`. */
    stickyHeader?: boolean
    /** CSS max-height of the scroll area (number = px). */
    maxHeight?: number | string
    /** Render only the rows in view. Needs `maxHeight`. */
    virtualized?: boolean
    /** Row height estimate for `virtualized`. Default 48. */
    estimateRowHeight?: number
}

type ContentStyle = CSSProperties & { '--data-table-max-height'?: string }

const cssLength = (value: number | string) =>
    Number.isFinite(value) ? `${String(value)}px` : String(value)

/** `aria-rowcount`: every row of the table, -1 when the server has not said. */
const ariaRowCount = <TData extends RowData>(
    table: CoreTable<DataTableFeatures, TData>,
    footerRows: number
) => {
    const total = totalRowCount(table)
    if (total === undefined) return -1
    return table.getHeaderGroups().length + total + footerRows
}

/** The table itself: header, body and footer in a scroll container. */
export const DataTableContent = <TData,>({
    children,
    className,
    columnMenu = false,
    stickyHeader = false,
    maxHeight,
    virtualized = false,
    estimateRowHeight = DEFAULT_ROW_HEIGHT,
    onRowOpen,
    rowOpenLabel,
    renderExpandedRow,
    emptyState,
}: DataTableContentProps<TData>) => {
    const table = useDataTableInstance<DataTableRowData<TData>>()
    const view = useDataTableView()
    // State, not a ref: the rows' virtualizer needs a render once the
    // container is mounted, and a child's effects run before a parent's ref is set.
    const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(
        null
    )
    const fixed = view.layout === 'fixed'
    const scrolls = maxHeight !== undefined
    const rowById = (rowId: string) => table.getRow(rowId)
    const content = {
        onRowOpen: onRowOpen && ((rowId: string) => onRowOpen(rowById(rowId))),
        rowOpenLabel:
            rowOpenLabel && ((rowId: string) => rowOpenLabel(rowById(rowId))),
        renderExpandedRow:
            renderExpandedRow &&
            ((rowId: string) => renderExpandedRow(rowById(rowId))),
        emptyState,
        columnMenu,
        stickyHeader,
        virtualized: virtualized && scrolls,
        estimateRowHeight,
        scrollElement,
    } satisfies DataTableContentContextValue

    const showFooter = hasColumnFooter(table)
    const footerRows = showFooter ? table.getFooterGroups().length : 0
    const showsRows =
        view.status !== 'loading' &&
        view.status !== 'error' &&
        table.getRowModel().rows.length > 0
    const style: ContentStyle = scrolls
        ? { '--data-table-max-height': cssLength(maxHeight) }
        : {}

    return (
        <DataTableContentContext.Provider value={content}>
            <div
                data-slot="data-table-content"
                className={cn('min-w-0', className)}
                style={style}
            >
                <Table
                    aria-label={view.label}
                    aria-rowcount={
                        showsRows ? ariaRowCount(table, footerRows) : undefined
                    }
                    containerRef={setScrollElement}
                    containerClassName={cn(
                        '[contain:layout] [overscroll-behavior-inline:contain]',
                        scrolls &&
                            'max-h-(--data-table-max-height) overflow-y-auto'
                    )}
                    style={
                        fixed
                            ? {
                                  tableLayout: 'fixed',
                                  width: `${table.getTotalSize()}px`,
                              }
                            : undefined
                    }
                >
                    {fixed && (
                        <colgroup>
                            {drawnColumns(table).map((column) => (
                                <col
                                    key={column.id}
                                    style={{ width: `${column.getSize()}px` }}
                                />
                            ))}
                        </colgroup>
                    )}
                    {children ?? (
                        <>
                            <DataTableHeader />
                            <DataTableBody />
                            {showFooter && <DataTableFooter />}
                        </>
                    )}
                </Table>
            </div>
        </DataTableContentContext.Provider>
    )
}
