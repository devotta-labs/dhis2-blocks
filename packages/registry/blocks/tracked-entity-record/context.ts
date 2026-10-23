import { createContext, useContext } from 'react'
import type { TrackedEntityRecordContextValue } from './types'

export const TrackedEntityRecordContext =
    createContext<TrackedEntityRecordContextValue | null>(null)

/** The record of the nearest TrackedEntityRecordProvider. */
export const useTrackedEntityRecord = (): TrackedEntityRecordContextValue => {
    const context = useContext(TrackedEntityRecordContext)

    if (!context) {
        throw new Error(
            'useTrackedEntityRecord must be used inside TrackedEntityRecordProvider'
        )
    }

    return context
}
