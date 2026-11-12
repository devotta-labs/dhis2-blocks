import type { Dhis2Calendar } from '@/components/dhis2-value-display'
import { createContext, useContext } from 'react'

/** Client state only: which record, how to display it, and what the mounted parts have claimed. The record itself comes from the query hooks. */
export interface HeaderContextValue {
    /** The trimmed tracked entity id; empty while the host has none. */
    trackedEntity: string
    /** The trimmed program, when there is one. */
    program?: string
    display: { calendar: Dhis2Calendar; locale?: string }
    /** Logs a config problem's full text, once per provider. */
    logProblem: (message: string) => void
    /** Marks an attribute as shown by a part, so the details list skips it. Returns the undo. Call it from a layout effect so it is settled before paint. */
    placeAttribute: (uid: string) => () => void
    placed: ReadonlySet<string>
    /** Marks a relationship type as named by a part, so its metadata is fetched even with no link. Returns the undo. Call it from a layout effect. */
    placeRelationshipType: (uid: string) => () => void
    relationshipTypes: ReadonlySet<string>
}

/** Internal: never exported from the block, so it cannot be swapped out. */
export const HeaderContext = createContext<HeaderContextValue | null>(null)

export const useHeaderContext = (): HeaderContextValue => {
    const context = useContext(HeaderContext)
    if (!context) {
        throw new Error(
            'Tracked entity header parts and hooks must be rendered inside TrackedEntityHeaderProvider'
        )
    }
    return context
}
