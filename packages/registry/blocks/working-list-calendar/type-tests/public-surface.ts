import type {
    WorkingListCalendarContextValue,
    WorkingListCalendarDisplay,
    WorkingListCalendarGridProps,
    WorkingListCalendarStatus,
    WorkingListCalendarTone,
    WorkingListCalendarWeekday,
    WorkingListCalendarDateField,
    WorkingListCalendarDay,
    WorkingListCalendarProps,
    WorkingListCalendarRecord,
} from '..'
import { useWorkingListCalendarDay } from '..'

export type SupportedWorkingListCalendarTypes = [
    WorkingListCalendarContextValue,
    WorkingListCalendarDisplay,
    WorkingListCalendarGridProps,
    WorkingListCalendarStatus,
    WorkingListCalendarTone,
    WorkingListCalendarWeekday,
    WorkingListCalendarDateField,
    WorkingListCalendarDay,
    WorkingListCalendarProps,
    WorkingListCalendarRecord,
]

export const readCellDay = (): number =>
    useWorkingListCalendarDay().day.records.length

export const uncontrolledProps: WorkingListCalendarProps = {
    dateField: 'eventScheduledAt',
    defaultSelectedDay: '2026-11-14',
    onRecordClick: () => undefined,
}

export const labelledProps: WorkingListCalendarProps = {
    recordLabel: (row, cellText) =>
        `${cellText('NationalId1')} · ${row.trackedEntityId ?? row.id}`,
}

export const statusProps: WorkingListCalendarProps = {
    defaultDisplay: 'records',
    recordStatus: (_row, cellText) => ({
        id: cellText('Priority001'),
        label: cellText('Priority001'),
        tone: 'warning',
    }),
}

export const controlledDisplay: WorkingListCalendarProps = {
    display: 'counts',
    onDisplayChange: () => undefined,
}

// @ts-expect-error A controlled display requires its change callback.
export const displayWithoutCallback: WorkingListCalendarProps = {
    display: 'counts',
}

export const fridaySaturdayWeekend: WorkingListCalendarGridProps = {
    weekend: [5, 6],
    weekendColumns: 'narrow',
}

export const badWeekday: WorkingListCalendarGridProps = {
    // @ts-expect-error Weekdays run from 1 (Monday) to 7 (Sunday).
    weekend: [0],
}

export const controlledProps: WorkingListCalendarProps = {
    selectedDay: null,
    onSelectedDayChange: () => undefined,
}

// @ts-expect-error A controlled selected day requires its change callback.
export const controlledWithoutCallback: WorkingListCalendarProps = {
    selectedDay: '2026-11-14',
}

export const unknownDateField: WorkingListCalendarProps = {
    // @ts-expect-error Only system date fields with an API date range place records.
    dateField: 'createdAt',
}

// @ts-expect-error The context is internal; read it through useWorkingListCalendar.
export { WorkingListCalendarContext } from '..'
