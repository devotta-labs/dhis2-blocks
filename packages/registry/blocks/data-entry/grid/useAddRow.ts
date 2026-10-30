import { useCallback, useEffect, useRef } from 'react'
import { cellDomId } from '../cells/cellProps'
import { cellKey } from '../model/types'
import type { GridTable } from '../model/types'

/** Adds a row to a table, then focuses the row's first open cell once it appears; one function for the grid's life. */
export const useAddRow = (
    idScope: string,
    tables: ReadonlyArray<GridTable>,
    addRow: (tableId: string) => void
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
        addRow(tableId)
    }
    useEffect(() => {
        const before = adding.current
        const table = tables.find(({ id }) => id === before?.tableId)
        const added = table?.rows.find(({ id }) => !before?.rows.has(id))
        if (table === undefined || added === undefined) {
            return
        }
        adding.current = undefined
        const column = table.columns.find(
            ({ id }) => !table.closed.has(cellKey(added.id, id))
        )
        if (column !== undefined) {
            document
                .getElementById(
                    cellDomId(idScope, cellKey(added.id, column.id))
                )
                ?.focus()
        }
    }, [idScope, tables])
    return useCallback((tableId: string) => addTo.current?.(tableId), [])
}
