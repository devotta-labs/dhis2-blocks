import type { useDataEngine } from '@dhis2/app-runtime'
import { createContext, useCallback, useContext, useMemo } from 'react'
import type { ComponentType } from 'react'
import { useStore } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { createStore } from 'zustand/vanilla'
import type { StoreApi } from 'zustand/vanilla'
import type { Politeness } from '@/components/dhis2/ui/announcer'
import type { ValueSettings } from '@/components/dhis2-value-types'
import type { CellOverrides } from '../cells/cellProps'
import type { AnnotationsState, CellAnnotations } from '../model/annotations'
import type {
    CellKey,
    CellState,
    CommitResult,
    GridColumn,
    GridRow,
    GridTable,
} from '../model/types'
import { EMPTY_CELL } from '../store/store'
import type { CellStoreState } from '../store/store'

export type DataEngine = ReturnType<typeof useDataEngine>

/** A store the spreadsheet only reads: the consumer's own, of this shape or a richer one, is passed in as it is. */
export type ReadonlyStore<T> = Pick<
    StoreApi<T>,
    'getState' | 'getInitialState' | 'subscribe'
>

/** What the cells and the grid read from the provider. */
export interface SpreadsheetContext {
    store: StoreApi<CellStoreState>
    effects: ReadonlyStore<AnnotationsState>
    /** Starts every DOM id of the form, so two forms on one page never share one. */
    idScope: string
    settings: ValueSettings
    /** Says an outcome to screen reader users; failures are `'assertive'`. */
    announce(text: string, politeness?: Politeness): void
    /** Focuses the cell, which scrolls it into view; a cell whose row the grid has not drawn is drawn first. */
    focusCell(key: CellKey): void
    /** The cell `focusCell` waits on while the grid draws its row. */
    focusing: StoreApi<{ key?: CellKey }>
    tables: ReadonlyArray<GridTable>
    /** The key of the row's cell in the column: what the cell's state, effects and DOM id are found by. */
    keyOf(row: GridRow, column: GridColumn): CellKey
    /** The keys the row's messages and notes are stored under in `effects`; the row header shows them all, once. */
    rowKeysOf(row: GridRow): ReadonlyArray<string>
    /**
     * The tables that take new rows, by table id: each is followed by a button with `label` that runs `add`, as does
     * Ctrl+Enter in its cells. The grid then focuses the new row's first open cell.
     */
    addRow?: ReadonlyMap<string, { label: string; add(): void }>
    /** Names a row in its header; by default its label cells' values (`labelFrom`), else its label. */
    RowLabel?: ComponentType<{ row: GridRow }>
    /** Shown beside a row's label, and named with the row only, not with each of its cells. */
    RowBadge?: ComponentType<{ rowId: string }>
    /** Shown once after every table; `skipTargetId` is the DOM id of the place "Skip past the grid" leads to. */
    GridFooter?: ComponentType<{ skipTargetId: string }>
    /** Whether the column's cells take row and column actions; every column by default. */
    bulkColumn?(column: GridColumn): boolean
    /**
     * Asked before a bulk action writes to these cells: the text of a dialog that asks the person first, or nothing to
     * write at once.
     */
    confirmBulk?(
        keys: ReadonlyArray<CellKey>
    ): { title: string; body: string; confirm: string } | undefined
    /** Whether the server cannot be reached now: files cannot be uploaded. */
    offline: boolean
    /**
     * Where the server serves the file a cell's stored value names, as an image when `image`; without an address, a
     * file or image cell shows the file's name only, with no preview and no download link.
     */
    fileUrl?(key: CellKey, image: boolean): string | undefined
    overrides?: CellOverrides
    /** Names of org units by id: those the form's values hold, then those picked in a cell. Org unit cells show them. */
    orgUnitNames: StoreApi<{ names: ReadonlyMap<string, string> }>
    /** Names of files by id: those the form's values hold, then those uploaded in an editor. File cells show them. */
    fileNames: StoreApi<{ names: ReadonlyMap<string, string> }>
}

/** What cells that show no names read instead: it never changes, so it renders nothing again. */
export const NO_NAMES: SpreadsheetContext['orgUnitNames'] = createStore(() => ({
    names: new Map(),
}))

/** `announce`, for code outside the grid that says outcomes too; the shared `announce` by default. */
export type Announcer = Pick<SpreadsheetContext, 'announce'>

/** What a cell with no entry reads as; one stable object. */
const EMPTY_EFFECTS: Readonly<CellAnnotations> = Object.freeze({
    required: false,
    messages: [],
})

export interface CellView extends CellState {
    effects: CellAnnotations
    /**
     * Saves what a person typed or chose through the store the built-in controls use: the text is checked against the
     * field, `'invalid'` keeps it as the cell's draft with its error, and an unchanged value writes nothing. A cell a
     * rule or its row locks (`effects.readOnly`), or that a rule hides, is not written to (`'unchanged'`) and keeps no
     * draft.
     */
    commit(text: string): CommitResult
}

export const SpreadsheetReactContext = createContext<
    SpreadsheetContext | undefined
>(undefined)

export const useSpreadsheetContext = (): SpreadsheetContext => {
    const context = useContext(SpreadsheetReactContext)
    if (context === undefined) {
        throw new Error('Cells must be used inside Spreadsheet.')
    }
    return context
}

/** A cell's view from its state and effects, as its row hands them over. */
export const useViewOf = (
    key: CellKey,
    cell: CellState,
    effects: CellAnnotations
): CellView => {
    const { store } = useSpreadsheetContext()
    // The store's gate reads the cell's lock and hiding when it commits, so a rule that closed the cell while its text
    // was typed wins.
    const commit = useCallback(
        (text: string): CommitResult => store.getState().commit(key, text),
        [store, key]
    )
    return useMemo(
        () => ({ ...cell, effects, commit }),
        [cell, effects, commit]
    )
}

/** One cell's state, effects and `commit`; it re-renders only when this cell changes in either store. */
export const useCellView = (key: CellKey): CellView => {
    const { store, effects } = useSpreadsheetContext()
    const cell = useStore(store, (state) => state.cells[key] ?? EMPTY_CELL)
    const cellEffects = useStore(
        effects,
        (state) => state.cells[key] ?? EMPTY_EFFECTS
    )
    return useViewOf(key, cell, cellEffects)
}

/**
 * The states and effects of a row's cells, in the order of `keys`: one subscription to each store for the whole row,
 * and a new array only when one of its cells changed.
 */
export const useRowCells = (keys: ReadonlyArray<CellKey>) => {
    const { store, effects } = useSpreadsheetContext()
    const selectStates = useShallow((state: CellStoreState) =>
        keys.map((key) => state.cells[key] ?? EMPTY_CELL)
    )
    const selectEffects = useShallow((state: AnnotationsState) =>
        keys.map((key) => state.cells[key] ?? EMPTY_EFFECTS)
    )
    const states = useStore(store, selectStates)
    const rowEffects = useStore(effects, selectEffects)
    return { states, effects: rowEffects }
}

/** Focuses a cell by its key, wherever the grid has scrolled: its row is drawn first when it is not. */
export const useFocusCell = () => {
    const { focusCell } = useSpreadsheetContext()
    return focusCell
}

/** Says an outcome to screen reader users, through the shared announcer. */
export const useAnnounce = () => {
    const { announce } = useSpreadsheetContext()
    return announce
}
