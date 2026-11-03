import type { ValueSettings } from '@/components/dhis2-value-types'
import { columnFields, nameFrom, rowLabel } from '../grid/headers'
import { fieldNamer } from '../logic/summary'
import { cellKey, recordIdOf, rowsByRecord } from '../model/types'
import type { GridRow, GridTable } from '../model/types'
import { unsentChangesCsv } from '../outbox/download'
import type { OutboxRecord } from '../outbox/outbox'
import { EVENT_DATE_COLUMN } from '../sources/eventSchemas'
import type { DataEntryState } from '../store/store'
import type { FormTables } from './openForm'

/**
 * Saves as a CSV file this form's changes the device holds, and the failed changes only this page holds (one it could
 * not store, even over an older one), with enough context to enter each again by hand. The program's other grids'
 * changes that could not be saved are in it too (theirs that wait are sent): a row the form does not show has its
 * id, and a field its id where the form has no column for it.
 */
export const saveUnsentFile = (
    held: ReadonlyArray<OutboxRecord>,
    inForm: (key: string) => boolean,
    cells: DataEntryState['cells'],
    { tables, records }: FormTables,
    settings: ValueSettings
) => {
    const saved = held.filter(
        ({ key, state }) => inForm(key) || state === 'failed'
    )
    const kept = new Map<string, string | null>(
        saved.map(({ key, value }) => [key, value])
    )
    const onlyHere = Object.entries(cells).flatMap(([key, cell]) =>
        cell?.sync === 'failed' && kept.get(key) !== (cell.value ?? null)
            ? [
                  {
                      key,
                      value: cell.value ?? null,
                      state: 'failed',
                      reason: cell.reason,
                  },
              ]
            : []
    )
    const rows = rowsByRecord(tables)
    const tableOf = new Map(
        tables.flatMap((table) =>
            table.rows.map((row): [GridRow, GridTable] => [row, table])
        )
    )
    const fields = columnFields(tables)
    const nameOf = fieldNamer(tables)
    const csv = unsentChangesCsv(
        [...saved, ...onlyHere].map(({ key, value, state, reason }) => {
            const rowId = recordIdOf(key)
            const row = rows.get(rowId)
            const table = row === undefined ? undefined : tableOf.get(row)
            return {
                form: table?.title ?? '',
                // As the grid names it.
                row:
                    row === undefined
                        ? rowId
                        : nameFrom(
                              row.labelFrom ?? [],
                              (row.labelFrom ?? []).map(
                                  (label) => cells[label]?.value
                              ),
                              fields,
                              settings
                          ) ||
                          rowLabel(
                              row,
                              records.get(row.id),
                              cells[cellKey(row.id, EVENT_DATE_COLUMN)]?.value,
                              settings
                          ),
                field: nameOf(key),
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
