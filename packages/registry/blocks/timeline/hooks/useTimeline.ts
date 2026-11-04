import { useContext } from 'react'
import {
    TimelineContext,
    type TimelineContextValue,
} from '../ui/TimelineContext'

/** The state and meta of the surrounding `Timeline`. */
export const useTimeline = <TData = unknown>(): TimelineContextValue<TData> => {
    const value = useContext(TimelineContext)
    if (value === null) {
        throw new Error('useTimeline must be used within Timeline.')
    }
    // SAFETY: Timeline stored a TimelineContextValue<TData'> for the host's
    // own TData'; the host picks the same TData here, as with any typed context.
    return value as TimelineContextValue<TData>
}

/** The surrounding timeline's context, or null outside one. */
export const useOptionalTimeline = (): TimelineContextValue | null =>
    useContext(TimelineContext)
