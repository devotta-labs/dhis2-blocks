import type { Dhis2Calendar } from '@/components/dhis2-value-display'
import { createContext, useContext } from 'react'
import type { AttributeMetadata, TrackedEntityRecord } from '../api/types'

export type TrackedEntityHeaderState =
    | { status: 'loading' | 'failed' | 'restricted'; retry(): void }
    | {
          status: 'ready'
          retry(): void
          trackedEntity: TrackedEntityRecord
          metadata: AttributeMetadata
      }

export interface HeaderContextValue {
    state: TrackedEntityHeaderState
    /** The trimmed program, when there is one. */
    program?: string
    display: { calendar: Dhis2Calendar; locale?: string }
    /** Logs a config problem's full text, once per provider. */
    logProblem: (message: string) => void
    /** Marks an attribute as shown by a part, so the details list skips it. Returns the undo. */
    placeAttribute: (uid: string) => () => void
    placed: ReadonlySet<string>
    /** The id of the heading that names the person, once one is rendered. */
    nameId?: string
    setNameId: (id: string | undefined) => void
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
