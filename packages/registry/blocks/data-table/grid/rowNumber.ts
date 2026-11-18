import type { Row, RowData } from '@tanstack/react-table'
import type { DataTableFeatures } from '../features'

// The row model's array is the same until the rows change.
const numbersByRows = new WeakMap<
    readonly { id: string }[],
    Map<string, number>
>()

/**
 * The row's position among the drawn rows of the page, from 1: the number in
 * "Open row {{number}}", "Select row {{n}}" and "Expand row {{n}}".
 */
export const dataTableRowNumber = <TData extends RowData>(
    row: Row<DataTableFeatures, TData>
): number => {
    const rows = row.table.getRowModel().rows
    let numbers = numbersByRows.get(rows)
    if (numbers === undefined) {
        numbers = new Map(
            rows.map((candidate, index) => [candidate.id, index + 1])
        )
        numbersByRows.set(rows, numbers)
    }
    return numbers.get(row.id) ?? row.index + 1
}
