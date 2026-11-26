import { useCallback } from 'react'
import type { TallyOptions } from '../core/types'
import { useTallyContext } from './context'
import { useCanUndo, useCellCount, useRowTotalAt, useSheetTotal } from './state'

/** The sheet's layout and columns, edit mode, and its tap and undo, for parts of your own. */
export const useTally = () => {
    const { layout, index, editing, setEditing, tapCell, undo } =
        useTallyContext('useTally')
    const canUndo = useCanUndo('useTally')
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
    const { index } = useTallyContext('useTallyCount')
    return useCellCount(index.cellOf(row, options) ?? -1)
}

/** What a row's cells add up to. */
export const useTallyRowTotal = (row: string) => {
    const { index } = useTallyContext('useTallyRowTotal')
    return useRowTotalAt(
        'useTallyRowTotal',
        index.rows.findIndex(({ id }) => id === row)
    )
}

/** What the whole sheet adds up to. */
export const useTallyTotal = () => {
    return useSheetTotal('useTallyTotal')
}
