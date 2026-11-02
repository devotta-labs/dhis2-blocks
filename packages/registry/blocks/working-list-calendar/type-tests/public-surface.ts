import type {
    WorkingListCalendarContextValue,
    WorkingListCalendarDateField,
    WorkingListCalendarDay,
    WorkingListCalendarProps,
    WorkingListCalendarRecord,
} from '..'

export type SupportedWorkingListCalendarTypes = [
    WorkingListCalendarContextValue,
    WorkingListCalendarDateField,
    WorkingListCalendarDay,
    WorkingListCalendarProps,
    WorkingListCalendarRecord,
]

export const uncontrolledProps: WorkingListCalendarProps = {
    dateField: 'eventScheduledAt',
    defaultSelectedDay: '2026-11-14',
    onRecordClick: () => undefined,
}

export const labelledProps: WorkingListCalendarProps = {
    recordLabel: (row, cellText) =>
        `${cellText('NationalId1')} · ${row.trackedEntityId ?? row.id}`,
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
