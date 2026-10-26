import { createContext, useContext, useMemo } from 'react'
import { useStore } from 'zustand'
import type { StoreApi } from 'zustand/vanilla'
import type { ValueSettings } from '@/components/dhis2-value-types'
import type { CellEffects } from '../logic/effects'
import type { CellKey, CellState } from '../model/types'
import { EMPTY_CELL } from '../store/store'
import type { DataEntryState } from '../store/store'

/** What logic says about each cell; only cells it has something to say about have an entry. */
export interface EffectsState {
    cells: Partial<Record<CellKey, CellEffects>>
}

/** What the cells read from the provider. */
export interface DataEntryContext {
    store: StoreApi<DataEntryState>
    effects: StoreApi<EffectsState>
    settings: ValueSettings
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
