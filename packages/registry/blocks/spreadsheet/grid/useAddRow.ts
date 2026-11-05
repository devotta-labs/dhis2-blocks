import { useCallback, useEffect, useRef } from 'react'
import type { GridTable } from '../model/types'
import type { SpreadsheetContext } from '../provider/context'

/** Adds a row to a table, then focuses the row's first open cell once it appears; one function for the grid's life. */
export const useAddRow = (
    focusCell: SpreadsheetContext['focusCell'],
    tables: ReadonlyArray<GridTable>,
    addRow: SpreadsheetContext['addRow'],
    keyOf: SpreadsheetContext['keyOf']
) => {
    // The table a row was added to and its rows before.
    const adding = useRef<{ tableId: string; rows: ReadonlySet<string> }>()
    const addTo = useRef<(tableId: string) => void>()
    addTo.current = (tableId) => {
        const table = tables.find(({ id }) => id === tableId)
        adding.current = {
            tableId,
            rows: new Set(table?.rows.map(({ id }) => id)),
        }
        addRow?.get(tableId)?.add()
    }
    useEffect(() => {
        const before = adding.current
        const table = tables.find(({ id }) => id === before?.tableId)
        const added = table?.rows.find(({ id }) => !before?.rows.has(id))
        if (table === undefined || added === undefined) {
            return
        }
        adding.current = undefined
        const key = table.columns
            .map((column) => keyOf(added, column))
            .find((each) => !table.closed.has(each))
        if (key !== undefined) {
            focusCell(key)
        }
    }, [focusCell, tables, keyOf])
    return useCallback((tableId: string) => addTo.current?.(tableId), [])
}
