import { createContext, useContext, useMemo } from 'react'
import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import type { StoreApi } from 'zustand/vanilla'
import type { ValueSettings } from '@/components/dhis2-value-types'
import type { CellOverrides } from '../cells/cellProps'
import type { CellEffects, CellMessage } from '../logic/effects'
import type { CellKey, CellState, GridTable } from '../model/types'
import { EMPTY_CELL } from '../store/store'
import type { DataEntryState } from '../store/store'

/** What logic says about each cell; only cells it has something to say about have an entry. */
export interface EffectsState {
    cells: Partial<Record<CellKey, CellEffects>>
    /** Row id → the messages without a field. */
    rowMessages: ReadonlyMap<string, ReadonlyArray<CellMessage>>
}

/** What the one polite live region says. */
interface Announcement {
    text: string
}

/** What the cells and the grid read from the provider. */
export interface DataEntryContext {
    store: StoreApi<DataEntryState>
    effects: StoreApi<EffectsState>
    settings: ValueSettings
    /** Says an outcome in the grid's one polite live region. */
    announce(text: string): void
    /** What `announce` last said, for the grid's live region to show. */
    announcements: StoreApi<Announcement>
    tables: ReadonlyArray<GridTable>
    /** Ids of the tables that take new rows: each has an "Add event" button. */
    newRowTables: ReadonlySet<string>
    addRow(tableId: string): void
    overrides?: CellOverrides
}

// Long enough for screen readers to notice the region emptied, so the same text said twice is heard twice.
const CLEARED_FOR_MS = 100

/** `announce` and the text it sets: the region is emptied first, then given the text. */
export const createAnnouncer = (): Pick<
    DataEntryContext,
    'announce' | 'announcements'
> => {
    const announcements = createStore<Announcement>()(() => ({ text: '' }))
    let timer: ReturnType<typeof setTimeout> | undefined
    return {
        announcements,
        announce(text) {
            clearTimeout(timer)
            announcements.setState({ text: '' })
            timer = setTimeout(
                () => announcements.setState({ text }),
                CLEARED_FOR_MS
            )
        },
    }
}

/** What a cell with no entry reads as; one stable object. */
const EMPTY_EFFECTS: Readonly<CellEffects> = Object.freeze({
    required: false,
    messages: [],
})

export interface CellView extends CellState {
    effects: CellEffects
}

export const DataEntryReactContext = createContext<
    DataEntryContext | undefined
>(undefined)

export const useDataEntryContext = (): DataEntryContext => {
    const context = useContext(DataEntryReactContext)
    if (context === undefined) {
        throw new Error('Cells must be used inside DataEntry.')
    }
    return context
}

/** One cell's effects; for a cell that needs no more, so it re-renders only when these change. */
export const useCellEffects = (key: CellKey): CellEffects => {
    const { effects } = useDataEntryContext()
    return useStore(effects, (state) => state.cells[key] ?? EMPTY_EFFECTS)
}

/** One cell's state and effects; it re-renders only when this cell changes in either store. */
export const useCellView = (key: CellKey): CellView => {
    const { store } = useDataEntryContext()
    const cell = useStore(store, (state) => state.cells[key] ?? EMPTY_CELL)
    const effects = useCellEffects(key)
    return useMemo(() => ({ ...cell, effects }), [cell, effects])
}
