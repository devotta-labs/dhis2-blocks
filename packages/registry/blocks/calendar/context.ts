import { createContext, useContext } from 'react'
import type { CalendarContextValue } from './types'

export type { CalendarDay, CalendarRecord } from './types'

export const CalendarContext = createContext<CalendarContextValue | null>(null)

/** The calendar's month, days, records and selection, for custom layouts. */
export const useCalendar = (): CalendarContextValue => {
    const context = useContext(CalendarContext)
    if (!context) throw new Error('useCalendar must be used within Calendar.')
    return context
}
