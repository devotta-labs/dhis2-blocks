import { memo } from 'react'
import { cn } from '@/components/dhis2/ui/cn'
import { RowCell } from '../cells/Cell'
import type { CellKey, GridRow, GridTable } from '../model/types'
import { useRowCells, useSpreadsheetStableContext } from '../provider/context'
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
    tableRef: { current: GridTable }
    row: GridRow
    keys: ReadonlyArray<CellKey>
    closedReasons: ReadonlyArray<string | undefined>
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

const sameValues = <T,>(left: ReadonlyArray<T>, right: ReadonlyArray<T>) =>
    left.length === right.length &&
    left.every((value, index) => value === right[index])

const sameRow = (before: TableRowProps, after: TableRowProps) =>
    before.idScope === after.idScope &&
    before.table.id === after.table.id &&
    before.table.columns === after.table.columns &&
    before.tableRef === after.tableRef &&
    before.row === after.row &&
    sameValues(before.keys, after.keys) &&
    sameValues(before.closedReasons, after.closedReasons) &&
    before.index === after.index &&
    before.rowIndex === after.rowIndex &&
    before.measure === after.measure &&
    before.labels === after.labels &&
    before.move === after.move &&
    before.openMenu === after.openMenu &&
    before.openNotes === after.openNotes

/** One row of a table: it reads its cells' states and effects, once for the row, and hands each cell its own. */
export const TableRow = memo(function TableRow({
    idScope,
    table,
    tableRef,
    row,
    keys,
    closedReasons,
    index,
    rowIndex,
    measure,
    labels,
    move,
    openMenu,
    openNotes,
}: TableRowProps) {
    const { store } = useSpreadsheetStableContext()
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
                        closedReason={closedReasons[c]}
                        cell={states[c]}
                        effects={effects[c]}
                    />
                </td>
            ))}
            <RowActions
                rowHeader={rowHeader}
                onOpen={(anchor) =>
                    openMenu({ anchor, table: tableRef.current, row })
                }
            />
        </tr>
    )
}, sameRow)
