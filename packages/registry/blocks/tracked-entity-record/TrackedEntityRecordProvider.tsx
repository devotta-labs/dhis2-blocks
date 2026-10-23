import type { ReactNode } from 'react'
import { TrackedEntityRecordContext } from './context'
import { useRecordState } from './useRecordState'

export interface TrackedEntityRecordProviderProps {
    trackedEntityId: string
    /** The programs this app cares about: exactly these, in this order (spec 7.2). */
    programs?: readonly string[]
    children: ReactNode
}

/** Loads one person's record once and hands it to every view below it. */
export const TrackedEntityRecordProvider = ({
    trackedEntityId,
    programs,
    children,
}: TrackedEntityRecordProviderProps) => {
    const value = useRecordState(trackedEntityId, programs)
    return (
        <TrackedEntityRecordContext.Provider value={value}>
            {children}
        </TrackedEntityRecordContext.Provider>
    )
}
