import type { Column, RowData, Table } from '@tanstack/react-table'
import type { CSSProperties } from 'react'
import type { DataTableFeatures } from '../features'
import type {
    DataTableColumnMeta,
    DataTableDensity,
    DataTableLayout,
} from '../types'

type AnyColumn<TData extends RowData> = Column<
    DataTableFeatures,
    TData,
    unknown
>

/** The visible leaf columns in the order they are drawn: pinned to start first. */
export const drawnColumns = <TData extends RowData>(
    table: Table<DataTableFeatures, TData>
) => [
    ...table.getStartVisibleLeafColumns(),
    ...table.getCenterVisibleLeafColumns(),
    ...table.getEndVisibleLeafColumns(),
]

/** Whether `column` is drawn last, at the table's end edge. */
export const isLastDrawnColumn = <TData extends RowData>(
    column: AnyColumn<TData>
) => drawnColumns(column.table).at(-1)?.id === column.id

interface ColumnPlacement {
    className: string | undefined
    style: CSSProperties | undefined
}

const unplaced: ColumnPlacement = { className: undefined, style: undefined }

/**
 * Where a header, body or footer cell of `column` sits: sticky offsets and the
 * edge border of a pinned column in layout 'fixed'. A group column takes its
 * offsets from its visible leaf columns.
 */
export const columnPlacement = <TData extends RowData>(
    column: AnyColumn<TData>,
    {
        layout,
        stickyHeaderCell = false,
    }: { layout: DataTableLayout; stickyHeaderCell?: boolean }
): ColumnPlacement => {
    if (layout !== 'fixed') return unplaced
    const pinned = column.getIsPinned()
    if (pinned === false) return unplaced
    const table = column.table
    const leaves = column.getLeafColumns().filter((leaf) => leaf.getIsVisible())
    const first = leaves.at(0)
    const last = leaves.at(-1)
    if (first === undefined || last === undefined) return unplaced
    const layer = stickyHeaderCell ? 'z-30' : 'z-10'
    if (pinned === 'start') {
        const edge = table.getStartVisibleLeafColumns().at(-1)?.id === last.id
        return {
            className: `sticky ${layer}${edge ? ' border-e' : ''}`,
            style: { insetInlineStart: `${first.getStart('start')}px` },
        }
    }
    const edge = table.getEndVisibleLeafColumns().at(0)?.id === first.id
    return {
        className: `sticky ${layer}${edge ? ' border-s' : ''}`,
        style: { insetInlineEnd: `${last.getAfter('end')}px` },
    }
}

const alignClasses = {
    start: 'text-start',
    center: 'text-center',
    end: 'text-end',
} as const

export const alignClass = (meta: DataTableColumnMeta | undefined) =>
    alignClasses[meta?.align ?? 'start']

const cellPadding = {
    compact: 'py-1.5',
    normal: undefined,
    comfortable: 'py-5',
} as const

export const cellDensityClass = (density: DataTableDensity) =>
    cellPadding[density]

export const headDensityClass = (density: DataTableDensity) =>
    density === 'compact' ? 'py-1' : undefined
