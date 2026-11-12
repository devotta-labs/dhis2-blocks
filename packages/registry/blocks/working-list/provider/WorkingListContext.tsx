import { createContext, useContext } from 'react'
import type {
    WorkingListConfiguration,
    WorkingListPagination,
} from './contracts'

export interface WorkingListContextValue {
    programId: string
    orgUnitId: string
    /** The selected view: a saved list's id, or the program's default list. */
    viewId: string
    /** Selects a saved view; `null` selects the program's default list. */
    selectView(viewId: string | null): void
    /** What the person changed on the selected view and has not saved. */
    draft?: WorkingListConfiguration
    /** Replaces the configuration on screen without saving it. */
    setDraft(configuration: WorkingListConfiguration): void
    pagination: WorkingListPagination
    setPagination(pagination: WorkingListPagination): void
}

export const WorkingListContext = createContext<WorkingListContextValue | null>(
    null
)

/**
 * What the person has chosen in the list: its view, draft and page. What the
 * server holds comes from the query hooks, which read these choices.
 */
export const useWorkingList = () => {
    const context = useContext(WorkingListContext)
    if (!context) {
        throw new Error('Working List hooks must be used within WorkingList.')
    }
    return context
}
