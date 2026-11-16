import { createContext, useContext } from 'react'
import type { AssignedClinic, Clinic } from '../api/schemas'

export type ClinicStatus = 'pending' | 'ready' | 'failed' | 'none'

export interface ClinicContextValue {
    status: ClinicStatus
    clinic?: Clinic
    assigned: AssignedClinic[]
    /** Valid, not assigned, newest first. */
    recent: Clinic[]
    searchable: boolean
    searchesServer: boolean
    setClinic: (clinic: Clinic) => void
    retry: () => void
}

/** Apart from the clinic, so typing in the search box re-renders the menu and not every page that reads the clinic. */
export interface ClinicSearchValue {
    query: string
    setQuery: (query: string) => void
    /** Asks for the hierarchy's first page, once the menu is first opened. */
    browse: () => void
    search: {
        status: 'pending' | 'ready' | 'failed'
        /** Every page loaded so far; with a blank query, the user's whole hierarchy by name. */
        clinics: Clinic[]
        hasMore: boolean
        loadingMore: boolean
        /** The last try for the next page failed. */
        moreFailed: boolean
        loadMore: () => void
        retry: () => void
    }
}

/** Internal: never exported from the block, so it cannot be swapped out. */
export const ClinicContext = createContext<ClinicContextValue | null>(null)

export const ClinicSearchContext = createContext<ClinicSearchValue | null>(null)

const OUTSIDE =
    'Clinic selector parts and hooks must be rendered inside ClinicProvider'

export const useClinicSearch = (): ClinicSearchValue => {
    const context = useContext(ClinicSearchContext)
    if (!context) {
        throw new Error(OUTSIDE)
    }
    return context
}

export const useClinicContext = (): ClinicContextValue => {
    const context = useContext(ClinicContext)
    if (!context) {
        throw new Error(OUTSIDE)
    }
    return context
}
