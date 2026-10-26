import type { GridRow, GridTable } from '../model/types'
import { unsentChangesCsv } from '../outbox/download'
import { rowIdOf } from './formRows'

interface Unsent {
    key: string
    value: string | null
    state: string
    reason?: string
}

/** Saves the changes as a CSV file, with enough context to enter each again by hand. */
export const saveUnsentFile = (
    changes: ReadonlyArray<Unsent>,
    tables: ReadonlyArray<GridTable>
) => {
    const rows = new Map(
        tables.flatMap((table) =>
            table.rows.map((row): [string, [GridTable, GridRow]] => [
                row.id,
                [table, row],
            ])
        )
    )
    const labels = new Map(
        tables.flatMap(({ columns }) =>
            columns.map(({ id, label }) => [id, label])
        )
    )
    const csv = unsentChangesCsv(
        changes.map(({ key, value, state, reason }) => {
            const rowId = rowIdOf(key)
            const column = key.slice(rowId.length + 1)
            const [table, row] = rows.get(rowId) ?? []
            return {
                form: table?.title ?? '',
                row: row?.label ?? rowId,
                field: labels.get(column) ?? column,
                value: value ?? '',
                state,
                reason: reason ?? '',
            }
        })
    )
    // A byte order mark first, so Excel reads the file as UTF-8.
    const url = URL.createObjectURL(
        new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' })
    )
    const link = document.createElement('a')
    link.href = url
    link.download = 'unsent-changes.csv'
    link.click()
    // Some browsers read the file after `click` returns.
    setTimeout(() => URL.revokeObjectURL(url), 40_000)
}
