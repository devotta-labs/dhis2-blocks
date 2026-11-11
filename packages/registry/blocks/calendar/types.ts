import type { useDatePicker } from '@dhis2/multi-calendar-dates'

export type CalendarTone =
    | 'neutral'
    | 'info'
    | 'positive'
    | 'warning'
    | 'critical'

export interface CalendarStatus {
    /** Records with the same id are counted together. */
    id: string
    label: string
    tone: CalendarTone
}

export interface CalendarRecord {
    id: string
    label: string
    /** YYYY-MM-DD in the calendar supplied to Calendar, not necessarily ISO. */
    date: string
    status?: CalendarStatus
    /** Lists the record without making its name interactive. */
    disabled?: boolean
}

export type CalendarDisplay = 'counts' | 'records'

export interface CalendarDay {
    date: string
    label: string | number
    isToday: boolean
    isInCurrentMonth: boolean
    isDisabled: boolean
    records: readonly CalendarRecord[]
}

export type CalendarResults =
    | { status: 'pending' }
    | { status: 'error'; retry: () => void }
    | {
          status: 'ready'
          records: readonly CalendarRecord[]
          truncated?: boolean
          isUpdating?: boolean
      }

type DatePicker = ReturnType<typeof useDatePicker>

export interface CalendarState {
    /**
     * Full weeks, including the neighbouring months' days. CalendarProvider
     * places the records on them.
     */
    weeks: ReadonlyArray<ReadonlyArray<Omit<CalendarDay, 'records'>>>
    /** Inclusive dates to request from a data source, in the chosen calendar. */
    visibleRange: { start: string; end: string }
    visibleMonth: number
    weekDayLabels: readonly string[]
    navigation: Pick<
        DatePicker,
        | 'prevMonth'
        | 'nextMonth'
        | 'currMonth'
        | 'currYear'
        | 'months'
        | 'years'
        | 'navigateToMonth'
        | 'navigateToYear'
    >
    selectedDate: string | null
    selectDay(date: string | null): void
    display: CalendarDisplay
    setDisplay(display: CalendarDisplay): void
    dayName(day: CalendarDay): string
    atStart: boolean
    atEnd: boolean
}

export interface CalendarContextValue {
    state: Pick<
        CalendarState,
        'visibleRange' | 'visibleMonth' | 'display' | 'atStart' | 'atEnd'
    > & {
        /** The visible weeks with each day's records. */
        weeks: ReadonlyArray<ReadonlyArray<CalendarDay>>
        selectedDay: CalendarDay | null
        results: CalendarResults
    }
    actions: Pick<CalendarState, 'selectDay' | 'setDisplay'> &
        Pick<
            DatePicker,
            'prevMonth' | 'nextMonth' | 'navigateToMonth' | 'navigateToYear'
        > & {
            onRecordClick?: (record: CalendarRecord) => void
        }
    meta: Pick<CalendarState, 'weekDayLabels' | 'dayName'> &
        Pick<DatePicker, 'currMonth' | 'currYear' | 'months' | 'years'>
}

export type CalendarSelectionProps =
    | {
          selectedDay?: never
          defaultSelectedDay?: string | null
          onSelectedDayChange?: (date: string | null) => void
      }
    | {
          selectedDay: string | null
          defaultSelectedDay?: never
          onSelectedDayChange: (date: string | null) => void
      }

export type CalendarDisplayProps =
    | {
          display?: never
          defaultDisplay?: CalendarDisplay
          onDisplayChange?: (display: CalendarDisplay) => void
      }
    | {
          display: CalendarDisplay
          defaultDisplay?: never
          onDisplayChange: (display: CalendarDisplay) => void
      }
