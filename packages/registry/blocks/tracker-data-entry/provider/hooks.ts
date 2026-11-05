import { createContext, useContext } from 'react'
import { useStore } from 'zustand'
import type { StoreApi } from 'zustand/vanilla'
import type { ValueSettings } from '@/components/dhis2-value-types'
import type { CellStoreState, GridTable } from '@/components/spreadsheet'
import type { summarise } from '../logic/summary'
import type { DataRecord, TrackerColumn, TrackerRow } from '../model/types'
import type { SaveOutcome, SyncStatus } from '../outbox/sync'

/** What `useTrackerDataEntry` selects from: the form's state and its actions. */
export interface TrackerDataEntryView {
    status: 'loading' | 'ready' | 'error'
    /** Why the form could not be loaded or opened, while `status` is `'error'`. */
    error?: string
    /** The form's tables as the grid shows them, new rows included: lay out controls of your own by their rows. */
    tables: ReadonlyArray<GridTable<TrackerRow, TrackerColumn>>
    /**
     * What the rows' cells save to, by record id (a row's own id names its record): its stage, org unit and status as
     * last saved, new rows included.
     */
    records: ReadonlyMap<string, DataRecord>
    summary: ReturnType<typeof summarise>
    sync: SyncStatus
    /** Adds a new row to a table that takes them; the grid focuses its first open cell. */
    addRow(tableId: string): void
    /**
     * Completes an event record (in an event grid, the row's id), unless one of its messages stops completion: those
     * come back as its `failed` outcomes. Rejects when DHIS2 cannot be reached.
     */
    complete(recordId: string): Promise<SaveOutcome[]>
    /** Reopens a completed event record the user may reopen. Rejects when DHIS2 cannot be reached. */
    reopen(recordId: string): Promise<SaveOutcome[]>
    /** Saves every change of the form DHIS2 does not have as a CSV file, those that could not be saved included. */
    downloadUnsent(): void
    /**
     * Drops the form's changes that could not be saved (refused by DHIS2, or not stored by this device) from the
     * device: their cells go back to what DHIS2 has.
     */
    discardFailed(): Promise<void>
    /** Whether the source may have more rows than the form shows: a next page to load. */
    hasMore: boolean
    /** Whether a page is loading. */
    loadingMore: boolean
    /** Why the last page could not load, until the next try starts; "Show more events" (or "Show more people") shows it. */
    loadMoreError?: string
    /** Appends the next page; one at a time. Says how many rows show, or why the page could not load. */
    loadMore(): Promise<void>
}

/** What the form's own parts of the grid (its row label and status badge) and its summary read besides the grid's. */
export interface TrackerContext {
    /** The tables as the form made them: rows with their slots and stage, columns with theirs. */
    tables: ReadonlyArray<GridTable<TrackerRow, TrackerColumn>>
    /** What the rows' cells save to, by record id (a row's own id names its record), with its status as last saved. */
    records: ReadonlyMap<string, DataRecord>
    /** Every field's display name, shown in a column or not, by id. */
    fieldNames?: ReadonlyMap<string, string>
    /** The form's cells, as the spreadsheet holds them. */
    store: StoreApi<CellStoreState>
    settings: ValueSettings
    /** Starts every DOM id of the form, as it starts the spreadsheet's. */
    idScope: string
}

export const TrackerReactContext = createContext<TrackerContext | undefined>(
    undefined
)

export const useTrackerContext = (): TrackerContext => {
    const context = useContext(TrackerReactContext)
    if (context === undefined) {
        throw new Error(
            'This part of the form must be used inside TrackerDataEntry.'
        )
    }
    return context
}

/** A failure's message, for `TrackerDataEntryView.error` and what the live region says. */
export const reasonOf = (error: Error | null) => error?.message ?? String(error)

export const TrackerDataEntryViewContext = createContext<
    StoreApi<TrackerDataEntryView> | undefined
>(undefined)

/** Anything about the form: re-renders only when what `select` returns changes, so select a value, not a new object. */
export const useTrackerDataEntry = <T>(
    select: (view: TrackerDataEntryView) => T
): T => {
    const view = useContext(TrackerDataEntryViewContext)
    if (view === undefined) {
        throw new Error(
            'useTrackerDataEntry must be used inside TrackerDataEntry.'
        )
    }
    return useStore(view, select)
}
