import { createContext, useContext } from 'react'
import { useStore } from 'zustand'
import type { StoreApi } from 'zustand/vanilla'
import type { summarise } from '../logic/summary'
import type { GridTable } from '../model/types'
import type { SaveOutcome, SyncStatus } from '../outbox/sync'

/** What `useDataEntry` selects from: the form's state and its actions. */
export interface DataEntryView {
    status: 'loading' | 'ready' | 'error'
    /** Why the form could not be loaded or opened, while `status` is `'error'`. */
    error?: string
    /** The form's tables as the grid shows them, new rows included: lay out controls of your own by their rows. */
    tables: ReadonlyArray<GridTable>
    summary: ReturnType<typeof summarise>
    sync: SyncStatus
    /** Adds a new row to a table that takes them; the grid focuses its first open cell. */
    addRow(tableId: string): void
    /** Completes a row, unless one of its messages stops completion: those come back as its `failed` outcomes. */
    complete(rowId: string): Promise<SaveOutcome[]>
    /** Reopens a completed row the user may reopen. */
    reopen(rowId: string): Promise<SaveOutcome[]>
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
    /** Why the last page could not load, until the next try starts; "Show more events" shows it. */
    loadMoreError?: string
    /** Appends the next page; one at a time. Says how many events show, or why the page could not load. */
    loadMore(): Promise<void>
}

/** A failure's message, for `DataEntryView.error` and what the live region says. */
export const reasonOf = (error: Error | null) => error?.message ?? String(error)

export const DataEntryViewContext = createContext<
    StoreApi<DataEntryView> | undefined
>(undefined)

/** Anything about the form: re-renders only when what `select` returns changes, so select a value, not a new object. */
export const useDataEntry = <T>(select: (view: DataEntryView) => T): T => {
    const view = useContext(DataEntryViewContext)
    if (view === undefined) {
        throw new Error('useDataEntry must be used inside DataEntry.')
    }
    return useStore(view, select)
}
