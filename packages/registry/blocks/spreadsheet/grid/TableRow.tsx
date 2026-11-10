import { memo } from 'react'
import { cn } from '@/components/dhis2/ui/cn'
import { RowCell } from '../cells/Cell'
import type { GridRow, GridTable } from '../model/types'
import { useSpreadsheetContext, useRowCells } from '../provider/context'
import { RowActions } from './BulkMenu'
import type { BulkTarget } from './BulkMenu'
import { rowHeaderDomId } from './headers'
import type { NavKey } from './navigation'
import { fieldAt } from './navGrid'
import { BORDER_CLASS, RowHeader } from './RowHeader'
import type { NotesTarget } from './RowNotes'

// A fixed height, a minimum in a table, lets the cell's control fill the row however tall the row header makes it.
const CELL_CLASS = cn(BORDER_CLASS, 'h-9 min-w-28 p-0')
// The last column's line is the actions column's own.
export const LAST_CLASS = 'border-e-0'

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
    move(key: NavKey): void
    openMenu(target: BulkTarget): void
    openNotes(target: NotesTarget): void
}

/** One row of a table: it reads its cells' states and effects, once for the row, and hands each cell its own. */
export const TableRow = memo(function TableRow({
    idScope,
    table,
    row,
    index,
    rowIndex,
    measure,
    labels,
    move,
    openMenu,
    openNotes,
}: TableRowProps) {
    const { keyOf, store } = useSpreadsheetContext()
    const keys = table.columns.map((column) => keyOf(row, column))
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
            {table.columns.map((column, c) => (
                <td
                    key={column.id}
                    className={cn(
                        CELL_CLASS,
                        c === keys.length - 1 && LAST_CLASS
                    )}
                >
                    <RowCell
                        cellKey={keys[c]}
                        field={fieldAt(store.getState(), keys[c])}
                        labelledBy={`${labels[c]} ${rowHeader}`}
                        move={move}
                        closedReason={table.closed.get(keys[c])}
                        cell={states[c]}
                        effects={effects[c]}
                    />
                </td>
            ))}
            <RowActions
                rowHeader={rowHeader}
                onOpen={(anchor) => openMenu({ anchor, table, row })}
            />
        </tr>
    )
})
