import { createContext, useContext } from 'react'
import type { ObservationSeries } from '../api/types'
import type { DisplayOptions } from '../format/display'

export interface ObservationCardContextValue {
    series: ObservationSeries
    /** The card's `label`, else the data element's own. */
    title: string
    unit?: string
    staleAfterDays?: number
    /** The latest reading is older than `staleAfterDays`. */
    stale: boolean
    /** When the card rendered, for "3 days ago". */
    now: Date
    display: DisplayOptions
    /** Called by a placed recorded note; returns its unregister. */
    registerRecorded: () => () => void
}

/** Internal: parts read their card's series through it. */
export const ObservationCardContext =
    createContext<ObservationCardContextValue | null>(null)

export const useObservationCard = (): ObservationCardContextValue => {
    const context = useContext(ObservationCardContext)
    if (!context) {
        throw new Error(
            'Observation parts must be rendered inside ObservationCard'
        )
    }
    return context
}
