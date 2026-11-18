import i18n from '@dhis2/d2-i18n'
import { cn } from '@/components/dhis2/ui/cn'
import { TableCell } from '@/components/dhis2/ui/table'
import type { Row, RowData } from '@tanstack/react-table'
import { Fragment, type ReactNode } from 'react'
import type { DataTableFeatures } from '../features'
import { DataTableCells } from './DataTableCells'
import { dataTableRowNumber } from './rowNumber'

/** What every data row needs besides the row itself. */
export interface DataTableRowsOptions<TData extends RowData> {
    onRowOpen: ((row: Row<DataTableFeatures, TData>) => void) | undefined
    rowOpenLabel: ((row: Row<DataTableFeatures, TData>) => string) | undefined
    /** `aria-rowindex` of the first row on the page. */
    firstRowIndex: number
}

// The classes `TableRow` sets; data rows are plain `<tr>`s so the virtualizer can measure them.
const ROW_CLASS = 'group/table-row data-[state=selected]:*:bg-dhis2-selected'

// The open button is hidden, so its row shows where focus is.
const OPENABLE_ROW_CLASS =
    'cursor-pointer has-[button[data-slot=data-table-row-open]:focus-visible]:outline-2 has-[button[data-slot=data-table-row-open]:focus-visible]:-outline-offset-2 has-[button[data-slot=data-table-row-open]:focus-visible]:outline-solid has-[button[data-slot=data-table-row-open]:focus-visible]:outline-dhis2-ring'

export const DataTableDataRow = <TData extends RowData>({
    row,
    position,
    options,
    measure,
    virtualIndex,
}: {
    row: Row<DataTableFeatures, TData>
    /** Position on the page, from 0. */
    position: number
    options: DataTableRowsOptions<TData>
    measure?: (element: HTMLTableRowElement | null) => void
    virtualIndex?: number
}) => {
    const { onRowOpen, rowOpenLabel, firstRowIndex } = options
    // A group row stands for many rows; its toggle is its only action.
    const open = row.getIsGrouped() ? undefined : onRowOpen
    return (
        <tr
            ref={measure}
            data-index={virtualIndex}
            data-slot="data-table-row"
            data-row-id={row.id}
            data-state={row.getIsSelected() ? 'selected' : undefined}
            aria-rowindex={firstRowIndex + position}
            className={cn(ROW_CLASS, open !== undefined && OPENABLE_ROW_CLASS)}
        >
            <DataTableCells
                row={row}
                leading={
                    open !== undefined && (
                        <button
                            type="button"
                            className="sr-only"
                            data-slot="data-table-row-open"
                            onClick={() => open(row)}
                        >
                            {rowOpenLabel?.(row) ??
                                i18n.t('Open row {{number}}', {
                                    number: dataTableRowNumber(row),
                                })}
                        </button>
                    )
                }
            />
        </tr>
    )
}

const DetailRow = ({
    span,
    children,
}: {
    span: number
    children: ReactNode
}) => (
    <tr data-slot="data-table-row-detail">
        <TableCell colSpan={span}>{children}</TableCell>
    </tr>
)

/** The rows of the page, each followed by its detail row when expanded. */
export const DataTableRows = <TData extends RowData>({
    rows,
    options,
    renderExpandedRow,
    span,
}: {
    rows: Row<DataTableFeatures, TData>[]
    options: DataTableRowsOptions<TData>
    renderExpandedRow:
        | ((row: Row<DataTableFeatures, TData>) => ReactNode)
        | undefined
    span: number
}) =>
    rows.map((row, position) => (
        <Fragment key={row.id}>
            <DataTableDataRow row={row} position={position} options={options} />
            {renderExpandedRow !== undefined &&
                !row.getIsGrouped() &&
                row.getIsExpanded() && (
                    <DetailRow span={span}>{renderExpandedRow(row)}</DetailRow>
                )}
        </Fragment>
    ))
