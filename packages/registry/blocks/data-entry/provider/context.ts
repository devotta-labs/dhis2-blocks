import { createContext, useCallback, useContext, useMemo } from 'react'
import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import type { StoreApi } from 'zustand/vanilla'
import type { ValueSettings } from '@/components/dhis2-value-types'
import type { CellOverrides } from '../cells/cellProps'
import type { CellEffects, CellMessage } from '../logic/effects'
import type {
    CellKey,
    CellState,
    CommitResult,
    GridTable,
} from '../model/types'
import { EMPTY_CELL } from '../store/store'
import type { DataEntryState } from '../store/store'

/** What logic says about each cell; only cells it has something to say about have an entry. */
export interface EffectsState {
    cells: Partial<Record<CellKey, CellEffects>>
    /** Row id → the messages without a field; `FORM_MESSAGES` → those about the whole form. */
    rowMessages: ReadonlyMap<string, ReadonlyArray<CellMessage>>
    /** Row id → what rules display for the row (texts and key-value pairs), shown under its label. */
    rowNotes: ReadonlyMap<string, ReadonlyArray<string>>
}

/** The `rowMessages` key of messages about the whole form; no row has an empty id. */
export const FORM_MESSAGES = ''

/** What the one polite live region says. */
interface Announcement {
    text: string
}

/** What the cells and the grid read from the provider. */
export interface DataEntryContext {
    store: StoreApi<DataEntryState>
    effects: StoreApi<EffectsState>
    /** Starts every DOM id of the form, so two forms on one page never share one. */
    idScope: string
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
// Between one text and the next, so a text said right after another is heard after it rather than over it.
const APART_MS = 150

/**
 * `announce` and the text it sets: each text in turn, 150 ms after the one before, the region emptied first. A newer
 * text replaces one still waiting: it is the newer news.
 */
export const createAnnouncer = (): Pick<
    DataEntryContext,
    'announce' | 'announcements'
> => {
    const announcements = createStore<Announcement>()(() => ({ text: '' }))
    const waiting: string[] = []
    let saying = false
    const sayNext = () => {
        const text = waiting.shift()
        saying = text !== undefined
        if (text === undefined) {
            return
        }
        announcements.setState({ text: '' })
        setTimeout(() => {
            announcements.setState({ text })
            setTimeout(sayNext, APART_MS - CLEARED_FOR_MS)
        }, CLEARED_FOR_MS)
    }
    return {
        announcements,
        announce(text) {
            waiting.splice(0, waiting.length, text)
            if (!saying) {
                sayNext()
            }
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
    /**
     * Saves what a person typed or chose through the store the built-in controls use: the text is checked against the
     * field, `'invalid'` keeps it as the cell's draft with its error, and an unchanged value writes nothing. A cell a
     * rule or its row locks (`effects.readOnly`) is not written to (`'unchanged'`); text typed into a cell a rule has
     * hidden, and not locked, is saved, and the rule then clears it.
     */
    commit(text: string): CommitResult
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
const useCellEffects = (key: CellKey): CellEffects => {
    const { effects } = useDataEntryContext()
    return useStore(effects, (state) => state.cells[key] ?? EMPTY_EFFECTS)
}

/** One cell's state, effects and `commit`; it re-renders only when this cell changes in either store. */
export const useCellView = (key: CellKey): CellView => {
    const { store, effects: effectsStore } = useDataEntryContext()
    const cell = useStore(store, (state) => state.cells[key] ?? EMPTY_CELL)
    const effects = useCellEffects(key)
    // The lock is read when committing, not when rendering: a rule may have locked the cell while its text was typed.
    const commit = useCallback(
        (text: string): CommitResult => {
            const { hiddenBy, readOnly } =
                effectsStore.getState().cells[key] ?? EMPTY_EFFECTS
            // A lock wins. Without one, text typed into a cell a rule has just hidden is saved, then cleared by the
            // rule, as the default controls do.
            return readOnly !== undefined ||
                (hiddenBy !== undefined && text === '')
                ? 'unchanged'
                : store.getState().commit(key, text)
        },
        [store, effectsStore, key]
    )
    return useMemo(
        () => ({ ...cell, effects, commit }),
        [cell, effects, commit]
    )
}
