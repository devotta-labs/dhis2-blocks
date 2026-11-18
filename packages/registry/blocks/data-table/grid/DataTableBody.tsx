import { cn } from '@/components/dhis2/ui/cn'
import { TableBody } from '@/components/dhis2/ui/table'
import type { MouseEvent, ReactNode } from 'react'
import { useDataTableView } from '../context'
import {
    useDataTableInstance,
    type DataTableRow,
    type DataTableRowData,
} from '../tableHook'
import { useDataTableContent } from './contentContext'
import { DataTableRows, type DataTableRowsOptions } from './DataTableRows'
import { ErrorRow, EmptyRow, SkeletonRows } from './states'
import { VirtualRows } from './VirtualRows'

export interface DataTableBodyProps<TData> {
    /** Makes rows openable: click, or Enter/Space on the row's hidden open button. */
    onRowOpen?: (row: DataTableRow<TData>) => void
    /** Accessible name of a row's open button. Default: "Open row {{number}}". */
    rowOpenLabel?: (row: DataTableRow<TData>) => string
    /** Detail content under an expanded row. */
    renderExpandedRow?: (row: DataTableRow<TData>) => ReactNode
    /** Replaces the default "No items to display" state. */
    emptyState?: ReactNode
}

// A click on one of these opens it, not the row.
const INTERACTIVE_TARGETS =
    'a, button, input, select, textarea, label, summary, [role="button"], [role="checkbox"], [role="menuitem"], [role="combobox"], [contenteditable="true"]'

/** A context callback, which takes a row id, as a callback on the row. */
const byRowId = <TRow extends { id: string }, TResult>(
    callback: ((rowId: string) => TResult) | undefined
) => {
    if (callback === undefined) return undefined
    return (row: TRow) => callback(row.id)
}

/** The `aria-rowindex` of the first body row on the current page. */
const firstBodyRowIndex = (
    headerRows: number,
    { pageIndex, pageSize }: { pageIndex: number; pageSize: number }
) => {
    // 0 × Infinity is NaN: with one endless page there is no offset.
    const offset = pageIndex === 0 ? 0 : pageIndex * pageSize
    return headerRows + offset + 1
}

/** The rows, or the loading, error or empty state in their place. */
export const DataTableBody = <TData,>(props: DataTableBodyProps<TData>) => {
    const table = useDataTableInstance<DataTableRowData<TData>>()
    const view = useDataTableView()
    const content = useDataTableContent()
    type BodyRow = DataTableRow<TData>
    const onRowOpen =
        props.onRowOpen ?? byRowId<BodyRow, void>(content.onRowOpen)
    const rowOpenLabel =
        props.rowOpenLabel ?? byRowId<BodyRow, string>(content.rowOpenLabel)
    const renderExpandedRow =
        props.renderExpandedRow ??
        byRowId<BodyRow, ReactNode>(content.renderExpandedRow)
    const emptyState =
        props.emptyState === undefined ? content.emptyState : props.emptyState

    const { status } = view
    const rows = table.getRowModel().rows
    const span = Math.max(1, table.getVisibleLeafColumns().length)
    const options = {
        onRowOpen,
        rowOpenLabel,
        firstRowIndex: firstBodyRowIndex(
            table.getHeaderGroups().length,
            table.state.pagination
        ),
    } satisfies DataTableRowsOptions<DataTableRowData<TData>>

    const openFromClick = (event: MouseEvent<HTMLTableSectionElement>) => {
        const target = event.target
        if (onRowOpen === undefined || !(target instanceof Element)) return
        // Clicks inside portals (menus, dialogs) bubble here through React.
        if (!event.currentTarget.contains(target)) return
        const element = target.closest('tr[data-slot="data-table-row"]')
        const interactive = target.closest(INTERACTIVE_TARGETS)
        if (element === null) return
        if (interactive !== null && element.contains(interactive)) return
        const id = element.getAttribute('data-row-id')
        const row = rows.find((candidate) => candidate.id === id)
        if (row !== undefined && !row.getIsGrouped()) onRowOpen(row)
    }

    const body = () => {
        if (status === 'loading') {
            return (
                <SkeletonRows
                    pageSize={table.state.pagination.pageSize}
                    columnCount={span}
                />
            )
        }
        if (status === 'error') return <ErrorRow span={span} />
        if (rows.length === 0) {
            return <EmptyRow span={span} emptyState={emptyState} />
        }
        if (content.virtualized) {
            return (
                <VirtualRows
                    rows={rows}
                    options={options}
                    span={span}
                    scrollElement={content.scrollElement}
                    estimateRowHeight={content.estimateRowHeight}
                />
            )
        }
        return (
            <DataTableRows
                rows={rows}
                options={options}
                renderExpandedRow={renderExpandedRow}
                span={span}
            />
        )
    }

    return (
        <TableBody
            data-slot="data-table-body"
            aria-busy={status === 'loading' || status === 'updating'}
            className={cn(
                status === 'updating' &&
                    'opacity-80 transition-opacity motion-reduce:transition-none'
            )}
            onClick={onRowOpen === undefined ? undefined : openFromClick}
        >
            {body()}
        </TableBody>
    )
}
