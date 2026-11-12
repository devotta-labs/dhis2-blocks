import { getNowInCalendar, useDatePicker } from '@dhis2/multi-calendar-dates'
import { useCallback, useMemo, useState } from 'react'
import type {
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

/** A value the caller owns when it passes one, and this hook keeps otherwise. */
const useControllableState = <T>(
    value: T | undefined,
    defaultValue: T,
    onChange?: (next: T) => void
): [T, (next: T) => void] => {
    const [ownValue, setOwnValue] = useState(defaultValue)
    const isControlled = value !== undefined
    const setValue = useCallback(
        (next: T) => {
            if (!isControlled) setOwnValue(next)
            onChange?.(next)
        },
        [isControlled, onChange]
    )
    return [isControlled ? value : ownValue, setValue]
}

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
    selectedDay,
    defaultSelectedDay = null,
    onSelectedDayChange,
    display: controlledDisplay,
    defaultDisplay = 'counts',
    onDisplayChange,
}: CalendarOptions = {}): CalendarState => {
    const [selectedDate, selectDay] = useControllableState(
        selectedDay,
        defaultSelectedDay,
        onSelectedDayChange
    )
    const [display, setDisplay] = useControllableState(
        controlledDisplay,
        defaultDisplay,
        onDisplayChange
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

    const gridDays = picker.calendarWeekDays.flat()
    const monthDays = gridDays.filter((day) => day.isInCurrentMonth)
    // Picker days are written YYYY-MM-DD in the system calendar.
    const monthOf = (date: string) => Number(date.slice(5, 7))
    const yearOf = (date: string) => Number(date.slice(0, 4))
    const monthName: CalendarState['monthName'] = (day) =>
        picker.months.find(({ value }) => value === monthOf(day.date))?.label ??
        picker.currMonth.label ??
        ''

    const firstDay = monthDays[0]?.dateValue
    const lastDay = monthDays.at(-1)?.dateValue
    return {
        weeks: picker.calendarWeekDays.map((week) =>
            week.map((day) => ({
                date: day.dateValue,
                label: day.label,
                isToday: day.isToday,
                isInCurrentMonth: day.isInCurrentMonth,
                isDisabled: isOutside(day.dateValue, { start, end }),
            }))
        ),
        visibleRange: {
            start: gridDays[0]?.dateValue ?? anchor,
            end: gridDays.at(-1)?.dateValue ?? anchor,
        },
        visibleMonth: firstDay ? monthOf(firstDay) : 1,
        weekDayLabels: picker.weekDayLabels,
        navigation: picker,
        selectedDate,
        selectDay,
        display,
        setDisplay,
        monthName,
        dayName: (day) => {
            const month = monthName(day)
            const year =
                picker.years.find(({ value }) => value === yearOf(day.date))
                    ?.label ?? yearOf(day.date)
            return `${day.label} ${month} ${year}`
        },
        atStart: Boolean(start && firstDay && firstDay <= start),
        atEnd: Boolean(end && lastDay && lastDay >= end),
    }
}
