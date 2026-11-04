import { createContext, useContext } from 'react'
import {
    useCalendar,
    useCalendarDay,
    type CalendarState,
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
    CalendarState,
    'weeks' | 'selectedDay'
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
    const { state, actions, meta } = useCalendar()
    const { recordsById, ...data } = useCalendarData()
    return {
        ...state,
        ...meta,
        selectDay: actions.selectDay,
        setDisplay: actions.setDisplay,
        navigation: {
            prevMonth: actions.prevMonth,
            nextMonth: actions.nextMonth,
            navigateToMonth: actions.navigateToMonth,
            navigateToYear: actions.navigateToYear,
            currMonth: meta.currMonth,
            currYear: meta.currYear,
            months: meta.months,
            years: meta.years,
        },
        ...data,
        onRecordClick: data.onRecordClick,
        weeks: state.weeks.map((week) =>
            week.map((day) => withTargets(day, recordsById))
        ),
        selectedDay: state.selectedDay
            ? withTargets(state.selectedDay, recordsById)
            : null,
        atFilterStart: state.atStart,
        atFilterEnd: state.atEnd,
    }
}

export const useWorkingListCalendarDay = () => {
    const { day, ...cell } = useCalendarDay()
    const { recordsById } = useCalendarData()
    return { ...cell, day: withTargets(day, recordsById) }
}
