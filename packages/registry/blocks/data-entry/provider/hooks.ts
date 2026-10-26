import { createContext, useContext } from 'react'
import { useStore } from 'zustand'
import type { StoreApi } from 'zustand/vanilla'
import type { summarise } from '../logic/summary'
import type { SaveOutcome, SyncStatus } from '../outbox/sync'

/** What `useDataEntry` selects from: the form's state and its actions. */
export interface DataEntryView {
    status: 'loading' | 'ready' | 'error'
    summary: ReturnType<typeof summarise>
    sync: SyncStatus
    /** Adds a new row to a table that takes them; the grid focuses its first open cell. */
    addRow(tableId: string): void
    /** Completes a row, unless one of its messages stops completion: those come back as its `failed` outcomes. */
    complete(rowId: string): Promise<SaveOutcome[]>
    /** Reopens a completed row the user may reopen. */
    reopen(rowId: string): Promise<SaveOutcome[]>
    /** Saves every unsent change of the form as a CSV file. */
    downloadUnsent(): void
}

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
