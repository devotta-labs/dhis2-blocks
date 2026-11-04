import { createContext, useContext } from 'react'
import type { ChangeSave } from '../../types'

/** Provided by `TimelineSave` and `TimelineChangeEntry`. */
export const TimelineSaveContext = createContext<ChangeSave | null>(null)

/** The save the surrounding `TimelineSave` or `TimelineChangeEntry` shows. */
export const useTimelineSave = (): ChangeSave => {
    const save = useContext(TimelineSaveContext)
    if (save === null) {
        throw new Error(
            'useTimelineSave must be used within TimelineSave or TimelineChangeEntry.'
        )
    }
    return save
}
