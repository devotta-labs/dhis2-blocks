import { memo } from 'react'
import { cn } from '@/components/dhis2/ui/cn'
import { RowCell } from '../cells/Cell'
import type { GridRow, GridTable } from '../model/types'
import { useSpreadsheetContext, useRowCells } from '../provider/context'
import { RowActions } from './BulkMenu'
import type { BulkTarget } from './BulkMenu'
import type { ColumnWindow } from './columnWindow'
import { rowHeaderDomId } from './headers'
import type { NavKey } from './navigation'
import { fieldAt } from './navGrid'
import { BORDER_CLASS, RowHeader } from './RowHeader'
import type { NotesTarget } from './RowNotes'

// A fixed height, a minimum in a table, lets the cell's control fill the row however tall the row header makes it.
const CELL_CLASS = cn(BORDER_CLASS, 'h-9 min-w-28 p-0')
// The last column's line is the actions column's own.
export const LAST_CLASS = 'border-e-0'

/** Space for columns not drawn, out of the accessibility tree. */
const Gap = ({ width }: { width: number }) => (
    <td
        aria-hidden="true"
        className="border-b border-dhis2-border p-0"
        style={{ minWidth: width }}
    />
)

interface TableRowProps {
    idScope: string
    table: GridTable
    row: GridRow
    /** The row's place among the table's rows, from 0. */
    index: number
    /** The row's place in the whole table, header rows included, from 1, for screen readers. */
    rowIndex: number
    /** Measures the drawn row, for the rows not drawn around it. */
    measure(element: Element | null): void
    /** The ids of the column headers that name each column's cells. */
    labels: ReadonlyArray<string>
    /** The columns drawn. */
    columns: ColumnWindow
    move(key: NavKey): void
    openMenu(target: BulkTarget): void
    openNotes(target: NotesTarget): void
}

/**
 * One row of a table, its drawn columns only: it reads their cells' states and effects, once for the row, and hands
 * each cell its own.
 */
export const TableRow = memo(function TableRow({
    idScope,
    table,
    row,
    index,
    rowIndex,
    measure,
    labels,
    columns,
    move,
    openMenu,
    openNotes,
}: TableRowProps) {
    const { keyOf, store } = useSpreadsheetContext()
    const count = table.columns.length
    const keys = columns.drawn.map(({ index }) =>
        keyOf(row, table.columns[index])
    )
    const { states, effects } = useRowCells(keys)
    const rowHeader = rowHeaderDomId(idScope, table.id, row.id)
    return (
        <tr ref={measure} data-index={index} aria-rowindex={rowIndex}>
            <RowHeader
                idScope={idScope}
                tableId={table.id}
                row={row}
                openNotes={openNotes}
            />
            {columns.drawn.flatMap(({ index, gap }, c) => [
                gap > 0 ? <Gap key={`gap-${index}`} width={gap} /> : null,
                <td
                    key={table.columns[index].id}
                    data-column={index}
                    aria-colindex={index + 2}
                    className={cn(
                        CELL_CLASS,
                        index === count - 1 && LAST_CLASS
                    )}
                >
                    <RowCell
                        cellKey={keys[c]}
                        field={fieldAt(store.getState(), keys[c])}
                        labelledBy={`${labels[index]} ${rowHeader}`}
                        move={move}
                        closedReason={table.closed.get(keys[c])}
                        cell={states[c]}
                        effects={effects[c]}
                    />
                </td>,
            ])}
            {columns.after > 0 ? <Gap width={columns.after} /> : null}
            <RowActions
                rowHeader={rowHeader}
                colIndex={count + 2}
                onOpen={(anchor) => openMenu({ anchor, table, row })}
            />
        </tr>
    )
})
