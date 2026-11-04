import { getNowInCalendar, useDatePicker } from '@dhis2/multi-calendar-dates'
import { useCallback, useMemo, useState } from 'react'
import type {
    CalendarDisplay,
    CalendarDisplayProps,
    CalendarSelectionProps,
    CalendarState,
} from './types'

type PickerCalendar = NonNullable<
    Parameters<typeof useDatePicker>[0]['options']['calendar']
>
export type CalendarSystem = keyof typeof PICKER_CALENDARS

// useDatePicker maps DHIS2 calendar ids at runtime, but its types accept only
// Temporal ids and the library does not export its map.
export const PICKER_CALENDARS = {
    coptic: 'coptic',
    ethiopian: 'ethiopic',
    gregorian: 'gregory',
    islamic: 'islamic',
    iso8601: 'iso8601',
    nepali: 'nepali',
    persian: 'persian',
    thai: 'buddhist',
} satisfies Record<string, PickerCalendar>

const pad = (value: number, length = 2) => String(value).padStart(length, '0')

/** Today in `calendar`, written the way the date picker writes days. */
const todayIn = (calendar: string, timeZone: string) => {
    const now = getNowInCalendar(calendar, timeZone)
    const year = calendar === 'iso8601' ? now.year : (now.eraYear ?? now.year)
    return `${pad(year, 4)}-${pad(now.month)}-${pad(now.day)}`
}

/** Moves `day` inside `bounds`, so the calendar opens where records can be. */
const clampDay = (day: string, bounds: { start?: string; end?: string }) => {
    if (bounds.end && day > bounds.end) return bounds.end
    if (bounds.start && day < bounds.start) return bounds.start
    return day
}

const isOutside = (day: string, bounds: { start?: string; end?: string }) =>
    Boolean(
        (bounds.start && day < bounds.start) || (bounds.end && day > bounds.end)
    )

export type CalendarOptions = CalendarSelectionProps &
    CalendarDisplayProps & {
        calendar?: CalendarSystem
        timeZone?: string
        locale?: string
        /** Inclusive selectable bounds in the chosen calendar (YYYY-MM-DD). */
        start?: string
        end?: string
    }

/** Calendar interaction state; use visibleRange to load records without an effect. */
export const useCalendarState = ({
    calendar = 'gregorian',
    timeZone = 'UTC',
    locale = 'en',
    start,
    end,
    selectedDay: controlledSelectedDay,
    defaultSelectedDay = null,
    onSelectedDayChange,
    display: controlledDisplay,
    defaultDisplay = 'counts',
    onDisplayChange,
}: CalendarOptions = {}): CalendarState => {
    const [uncontrolledSelectedDay, setUncontrolledSelectedDay] =
        useState(defaultSelectedDay)
    const selectedDate =
        controlledSelectedDay === undefined
            ? uncontrolledSelectedDay
            : controlledSelectedDay
    const selectDay = useCallback(
        (date: string | null) => {
            if (controlledSelectedDay === undefined) {
                setUncontrolledSelectedDay(date)
            }
            onSelectedDayChange?.(date)
        },
        [controlledSelectedDay, onSelectedDayChange]
    )

    const [uncontrolledDisplay, setUncontrolledDisplay] =
        useState(defaultDisplay)
    const display = controlledDisplay ?? uncontrolledDisplay
    const setDisplay = useCallback(
        (next: CalendarDisplay) => {
            if (controlledDisplay === undefined) setUncontrolledDisplay(next)
            onDisplayChange?.(next)
        },
        [controlledDisplay, onDisplayChange]
    )

    // The picker opens on `date` and moves when it changes. Clearing the
    // selection keeps the month in view, so only a newly selected day or,
    // before any selection, the filter's dates move it.
    const [lastSelectedDay, setLastSelectedDay] = useState(selectedDate)
    if (selectedDate !== null && selectedDate !== lastSelectedDay) {
        setLastSelectedDay(selectedDate)
    }
    const anchor = useMemo(
        () => clampDay(todayIn(calendar, timeZone), { start, end }),
        [start, end, calendar, timeZone]
    )
    const picker = useDatePicker({
        date: selectedDate ?? lastSelectedDay ?? anchor,
        options: { calendar: PICKER_CALENDARS[calendar], timeZone, locale },
        onDateSelect: (payload) =>
            selectDay(payload?.calendarDateString ?? null),
    })

    const monthDays = picker.calendarWeekDays
        .flat()
        .filter((day) => day.isInCurrentMonth)
    const gridDays = picker.calendarWeekDays.flat()
    const weeks = picker.calendarWeekDays.map((week) =>
        week.map((day) => ({
            date: day.dateValue,
            label: day.label,
            isToday: day.isToday,
            isInCurrentMonth: day.isInCurrentMonth,
            isDisabled: isOutside(day.dateValue, { start, end }),
            records: [],
        }))
    )
    const selectedDay =
        weeks.flat().find((day) => day.date === selectedDate) ?? null
    // Picker days are written YYYY-MM-DD in the system calendar.
    const monthOf = (date: string) => Number(date.slice(5, 7))
    const yearOf = (date: string) => Number(date.slice(0, 4))

    const firstDay = monthDays[0]?.dateValue
    const lastDay = monthDays.at(-1)?.dateValue
    return {
        weeks,
        visibleRange: {
            start: gridDays[0]?.dateValue ?? anchor,
            end: gridDays.at(-1)?.dateValue ?? anchor,
        },
        visibleMonth: firstDay ? monthOf(firstDay) : 1,
        weekDayLabels: picker.weekDayLabels,
        navigation: picker,
        selectedDay,
        selectDay,
        display,
        setDisplay,
        dayName: (day) => {
            const month =
                picker.months.find(({ value }) => value === monthOf(day.date))
                    ?.label ?? picker.currMonth.label
            const year =
                picker.years.find(({ value }) => value === yearOf(day.date))
                    ?.label ?? yearOf(day.date)
            return `${day.label} ${month} ${year}`
        },
        atStart: Boolean(start && firstDay && firstDay <= start),
        atEnd: Boolean(end && lastDay && lastDay >= end),
    }
}
