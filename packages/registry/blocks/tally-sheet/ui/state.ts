import { useMemo } from 'react'
import { useStore } from 'zustand'
import { useTallyContext } from './context'
import { activeCell } from './pointer'

/** One cell's count, by cell number. Re-renders only when that count changes. */
export const useCellCount = (cell: number) => {
    const { store } = useTallyContext('TallyGrid')
    return useStore(store, (state) => state.counts[cell] ?? 0)
}

/** What a row's cells add up to, by row number. */
export const useRowTotalAt = (name: string, at: number) => {
    const { store } = useTallyContext(name)
    return useStore(store, (state) => state.rowTotals[at] ?? 0)
}

/** What the whole sheet adds up to. */
export const useSheetTotal = (name: string) => {
    const { store } = useTallyContext(name)
    return useStore(store, (state) => state.total)
}

/** Whether this device has an entry left to take back. */
export const useCanUndo = (name: string) => {
    const { store } = useTallyContext(name)
    return useStore(store, (state) => state.canUndo)
}

/** Whether a cell is the grid's one tab stop: the cell last focused, else the first open one. */
export const useIsTabStop = (cell: number, firstOpen: boolean) => {
    const { pointer } = useTallyContext('TallyGrid')
    return useStore(pointer.tabStop, ({ tabStop }) =>
        tabStop === undefined ? firstOpen : tabStop === cell
    )
}

/** Whether the cell in hand, pointed at or else focused, is under this column heading. */
export const useColumnInHand = (at: number, span: number) => {
    const { pointer, index } = useTallyContext('TallyGrid')
    const size = index.columns.length
    return useStore(pointer.headings, (state) => {
        const cell = activeCell(state)
        return cell !== undefined && Math.floor((cell % size) / span) === at
    })
}

/** Whether the cell in hand, pointed at or else focused, is in this row. */
export const useRowInHand = (at: number) => {
    const { pointer, index } = useTallyContext('TallyGrid')
    const size = index.columns.length
    return useStore(pointer.headings, (state) => {
        const cell = activeCell(state)
        return cell !== undefined && Math.floor(cell / size) === at
    })
}

/** Says which cell holds focus and which a mouse points at, for the headings and the tab stop to follow. */
export const useCellInHand = () => {
    const { pointer, index } = useTallyContext('TallyGrid')
    return useMemo(
        () => ({
            focused(cell: number, field: boolean) {
                pointer.headings.setState({ focused: cell })
                if (field) pointer.tabStop.setState({ field: cell })
                if (!index.isClosed(cell)) {
                    pointer.tabStop.setState({ tabStop: cell })
                }
            },
            blurred() {
                pointer.headings.setState({ focused: undefined })
            },
            pointed(cell: number | undefined) {
                if (pointer.headings.getState().pointed !== cell) {
                    pointer.headings.setState({ pointed: cell })
                }
            },
        }),
        [pointer, index]
    )
}
