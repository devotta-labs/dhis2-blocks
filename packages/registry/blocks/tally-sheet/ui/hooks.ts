import { useCallback } from 'react'
import { useStore } from 'zustand'
import type { TallyOptions } from '../core/types'
import { useTallyContext } from './context'

/** The sheet's layout and columns, edit mode, and its tap and undo, for parts of your own. */
export const useTally = () => {
    const { layout, index, store, editing, setEditing, tapCell, undo } =
        useTallyContext('useTally')
    const canUndo = useStore(store, (state) => state.canUndo)
    const tap = useCallback(
        (row: string, options: TallyOptions) => {
            const cell = index.cellOf(row, options)
            if (cell !== undefined) tapCell(cell)
        },
        [index, tapCell]
    )
    return {
        layout,
        columns: index.columns,
        editing,
        setEditing,
        tap,
        undo,
        canUndo,
    }
}

/** One cell's count: the row's, in the column with these options. Zero for a cell the sheet does not have. */
export const useTallyCount = (row: string, options: TallyOptions) => {
    const { store, index } = useTallyContext('useTallyCount')
    const cell = index.cellOf(row, options)
    return useStore(store, (state) =>
        cell === undefined ? 0 : (state.counts[cell] ?? 0)
    )
}

/** What a row's cells add up to. */
export const useTallyRowTotal = (row: string) => {
    const { store, index } = useTallyContext('useTallyRowTotal')
    const at = index.rows.findIndex(({ id }) => id === row)
    return useStore(store, (state) => state.rowTotals[at] ?? 0)
}

/** What the whole sheet adds up to. */
export const useTallyTotal = () => {
    const { store } = useTallyContext('useTallyTotal')
    return useStore(store, (state) => state.total)
}
