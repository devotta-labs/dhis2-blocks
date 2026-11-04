import { createContext, useContext } from 'react'
import {
    useCalendar,
    useCalendarDay,
    type CalendarContextValue,
    type CalendarDay,
    type CalendarRecord,
} from '@/components/calendar'
import type {
    WorkingListDateFieldId,
    WorkingListDateRangeResults,
    WorkingListResultTarget,
} from '@/components/working-list'

export interface WorkingListCalendarRecord extends CalendarRecord {
    target?: WorkingListResultTarget
}

export interface WorkingListCalendarDay extends CalendarDay {
    records: readonly WorkingListCalendarRecord[]
}

interface WorkingListCalendarData {
    dateField: WorkingListDateFieldId
    results: WorkingListDateRangeResults
    recordsById: ReadonlyMap<string, WorkingListCalendarRecord>
    onRecordClick?: (target: WorkingListResultTarget) => void
}

export const WorkingListCalendarContext =
    createContext<WorkingListCalendarData | null>(null)

const useCalendarData = () => {
    const data = useContext(WorkingListCalendarContext)
    if (!data)
        throw new Error(
            'useWorkingListCalendar must be used within WorkingListCalendar.'
        )
    return data
}

const withTargets = (
    day: CalendarDay,
    records: WorkingListCalendarData['recordsById']
): WorkingListCalendarDay => ({
    ...day,
    records: day.records.map((record) => records.get(record.id) ?? record),
})

export interface WorkingListCalendarContextValue extends Omit<
    CalendarContextValue,
    'weeks' | 'selectedDay' | 'results' | 'onRecordClick'
> {
    dateField: WorkingListDateFieldId
    weeks: ReadonlyArray<ReadonlyArray<WorkingListCalendarDay>>
    selectedDay: WorkingListCalendarDay | null
    atFilterStart: boolean
    atFilterEnd: boolean
    results: WorkingListDateRangeResults
    onRecordClick?: (target: WorkingListResultTarget) => void
}

/** Calendar state plus the list's date field, query results and record targets. */
export const useWorkingListCalendar = (): WorkingListCalendarContextValue => {
    const calendar = useCalendar()
    const { recordsById, ...data } = useCalendarData()
    return {
        ...calendar,
        ...data,
        onRecordClick: data.onRecordClick,
        weeks: calendar.weeks.map((week) =>
            week.map((day) => withTargets(day, recordsById))
        ),
        selectedDay: calendar.selectedDay
            ? withTargets(calendar.selectedDay, recordsById)
            : null,
        atFilterStart: calendar.atStart,
        atFilterEnd: calendar.atEnd,
    }
}

export const useWorkingListCalendarDay = () => {
    const { day, ...cell } = useCalendarDay()
    const { recordsById } = useCalendarData()
    return { ...cell, day: withTargets(day, recordsById) }
}
