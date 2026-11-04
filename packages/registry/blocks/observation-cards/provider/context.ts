import { createContext, useContext } from 'react'
import type { ProgramMetadata, TrackerEventRecord } from '../api/types'

export interface ObservationsContextValue {
    program: string
    /** Undefined until the program's metadata has loaded. */
    metadata?: ProgramMetadata
    /** Undefined until both the person's enrollment and events have loaded. */
    events?: TrackerEventRecord[]
    /** The first failed request, if any. */
    error?: Error
    /** Logs a config problem's full text, once per provider. */
    logProblem: (message: string) => void
}

/** Internal: never exported from the block, so it cannot be swapped out. */
export const ObservationsContext =
    createContext<ObservationsContextValue | null>(null)

export const useObservationsContext = (): ObservationsContextValue => {
    const context = useContext(ObservationsContext)
    if (!context) {
        throw new Error(
            'Observation cards and hooks must be rendered inside ObservationsProvider'
        )
    }
    return context
}
