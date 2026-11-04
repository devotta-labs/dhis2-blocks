import { createContext, useContext } from 'react'
import type { TimelineEntry } from '../../../core/types'
import type { EventEntryData } from '../../types'

/** Provided by `TimelineEventEntry`. */
export const TimelineEventContext =
    createContext<TimelineEntry<EventEntryData> | null>(null)

/** The event entry the surrounding `TimelineEventEntry` shows. */
export const useTimelineEventEntry = (): TimelineEntry<EventEntryData> => {
    const entry = useContext(TimelineEventContext)
    if (entry === null) {
        throw new Error(
            'useTimelineEventEntry must be used within TimelineEventEntry.'
        )
    }
    return entry
}
