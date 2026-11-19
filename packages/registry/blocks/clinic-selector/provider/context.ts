import { createContext, useContext } from 'react'
import type { ClinicResourceClient } from '../api/client'
import type { AssignedClinic, Clinic } from '../api/schemas'

export type ClinicStatus = 'pending' | 'ready' | 'failed' | 'none'

export interface ClinicState {
    status: ClinicStatus
    clinic?: Clinic
    assigned: AssignedClinic[]
    /** Valid, not assigned, newest first. */
    recent: Clinic[]
}

export interface ClinicActions {
    setClinic: (clinic: Clinic) => void
    retry: () => void
}

/** What the selector's search asks the server with. */
export interface ClinicSource {
    client: ClinicResourceClient
    cacheId: number
    userId?: string
}

export interface ClinicContextValue {
    state: ClinicState
    actions: ClinicActions
    source: ClinicSource
}

/** Internal: never exported from the block, so it cannot be swapped out. */
export const ClinicContext = createContext<ClinicContextValue | null>(null)

export const useClinicContext = (): ClinicContextValue => {
    const context = useContext(ClinicContext)
    if (!context) {
        throw new Error(
            'Clinic selector parts and hooks must be rendered inside ClinicProvider'
        )
    }
    return context
}
