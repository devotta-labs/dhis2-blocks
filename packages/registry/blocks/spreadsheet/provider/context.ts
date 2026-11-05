import type { useDataEngine } from '@dhis2/app-runtime'
import { createContext, useCallback, useContext, useMemo } from 'react'
import type { ComponentType } from 'react'
import { useStore } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { createStore } from 'zustand/vanilla'
import type { StoreApi } from 'zustand/vanilla'
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

/** What the one polite live region says. */
interface Announcement {
    text: string
}

/** What the cells and the grid read from the provider. */
export interface SpreadsheetContext {
    store: StoreApi<CellStoreState>
    effects: ReadonlyStore<AnnotationsState>
    /** Starts every DOM id of the form, so two forms on one page never share one. */
    idScope: string
    settings: ValueSettings
    /** Says an outcome in the grid's one polite live region. */
    announce(text: string): void
    /** What `announce` last said, for the grid's live region to show. */
    announcements: StoreApi<Announcement>
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
    /** What the searching and uploading cells ask the server with. */
    engine: DataEngine
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

// Long enough for screen readers to notice the region emptied, so the same text said twice is heard twice.
const CLEARED_FOR_MS = 100
// Between one text and the next, so a text said right after another is heard after it rather than over it.
const APART_MS = 150

/** `announce`, and what it last said for the live region to show. */
export type Announcer = Pick<SpreadsheetContext, 'announce' | 'announcements'>

/**
 * `announce` and the text it sets: each text in turn, 150 ms after the one before, the region emptied first. A newer
 * text replaces one still waiting: it is the newer news.
 */
export const createAnnouncer = (): Announcer => {
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
const EMPTY_EFFECTS: Readonly<CellAnnotations> = Object.freeze({
    required: false,
    messages: [],
})

export interface CellView extends CellState {
    effects: CellAnnotations
    /**
     * Saves what a person typed or chose through the store the built-in controls use: the text is checked against the
     * field, `'invalid'` keeps it as the cell's draft with its error, and an unchanged value writes nothing. A cell a
     * rule or its row locks (`effects.readOnly`) is not written to (`'unchanged'`); text typed into a cell a rule has
     * hidden, and not locked, is saved, and the rule then clears it.
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
    const { store, effects: effectsStore } = useSpreadsheetContext()
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

/** One cell's state, effects and `commit`; it re-renders only when this cell changes in either store. */
export const useCellView = (key: CellKey): CellView => {
    const { store, effects } = useSpreadsheetContext()
    return useViewOf(
        key,
        useStore(store, (state) => state.cells[key] ?? EMPTY_CELL),
        useStore(effects, (state) => state.cells[key] ?? EMPTY_EFFECTS)
    )
}

/**
 * The states and effects of a row's cells, in the order of `keys`: one subscription to each store for the whole row,
 * and a new array only when one of its cells changed.
 */
export const useRowCells = (keys: ReadonlyArray<CellKey>) => {
    const { store, effects } = useSpreadsheetContext()
    return {
        states: useStore(
            store,
            useShallow((state) =>
                keys.map((key) => state.cells[key] ?? EMPTY_CELL)
            )
        ),
        effects: useStore(
            effects,
            useShallow((state) =>
                keys.map((key) => state.cells[key] ?? EMPTY_EFFECTS)
            )
        ),
    }
}

/** Says an outcome in the spreadsheet's one polite live region. */
export const useAnnounce = () => useSpreadsheetContext().announce
