import { createContext, useContext } from 'react'
import type { OrgUnitResourceClient } from '../api/client'
import type { AssignedOrgUnit, OrgUnit } from '../api/schemas'

export type OrgUnitStatus = 'pending' | 'ready' | 'failed' | 'none'

export interface OrgUnitState {
    status: OrgUnitStatus
    orgUnit?: OrgUnit
    assigned: AssignedOrgUnit[]
    /** Valid, not assigned, newest first. */
    recent: OrgUnit[]
}

export interface OrgUnitActions {
    setOrgUnit: (orgUnit: OrgUnit) => void
    retry: () => void
}

/** What the selector's search asks the server with. */
export interface OrgUnitSource {
    client: OrgUnitResourceClient
    cacheId: number
    userId?: string
}

export interface OrgUnitContextValue {
    state: OrgUnitState
    actions: OrgUnitActions
    source: OrgUnitSource
}

/** Internal: never exported from the block, so it cannot be swapped out. */
export const OrgUnitContext = createContext<OrgUnitContextValue | null>(null)

export const useOrgUnitContext = (): OrgUnitContextValue => {
    const context = useContext(OrgUnitContext)
    if (!context) {
        throw new Error(
            'Organisation unit switcher parts and hooks must be rendered inside OrgUnitProvider'
        )
    }
    return context
}
