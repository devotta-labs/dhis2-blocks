import {
    convertFromIso8601,
    convertToIso8601,
    validateDateString,
} from '@dhis2/multi-calendar-dates'
import type { Dhis2Calendar } from './types'
export type { Dhis2Calendar } from './types'

type MultiCalendarIdentifier = Parameters<typeof convertFromIso8601>[1]

/** DHIS2's calendar names as `@dhis2/multi-calendar-dates` and CalendarInput know them. */
export const toMultiCalendarIdentifier = (
    calendar: Dhis2Calendar
): MultiCalendarIdentifier =>
    (
        ({
            coptic: 'coptic',
            ethiopian: 'ethiopic',
            gregorian: 'gregory',
            islamic: 'islamic',
            iso8601: 'iso8601',
            nepali: 'nepali',
            persian: 'persian',
            thai: 'buddhist',
        }) satisfies Record<Dhis2Calendar, MultiCalendarIdentifier>
    )[calendar]

export interface CalendarDateParts {
    year: number
    month: number
    day: number
}

const pad = (value: number, length = 2) =>
    value.toString().padStart(length, '0')

export const calendarDateString = ({ year, month, day }: CalendarDateParts) =>
    `${pad(year, 4)}-${pad(month)}-${pad(day)}`

// The Ethiopian and Coptic calendars have twelve 30-day months and a short
// 13th (Pagume / Nasie). Temporal's era handling for them is unreliable, so,
// they convert through the Julian day number.
const EPAGOMENAL_EPOCHS = {
    coptic: 1825030,
    ethiopian: 1724221,
} as const

type EpagomenalCalendar = keyof typeof EPAGOMENAL_EPOCHS

export const isEpagomenalCalendar = (
    calendar: Dhis2Calendar
): calendar is EpagomenalCalendar =>
    calendar === 'coptic' || calendar === 'ethiopian'

const epagomenalDays = (year: number) => (year % 4 === 3 ? 6 : 5)

const isValidEpagomenalDate = ({ year, month, day }: CalendarDateParts) =>
    year > 0 &&
    month >= 1 &&
    month <= 13 &&
    day >= 1 &&
    day <= (month <= 12 ? 30 : epagomenalDays(year))

const gregorianToJulianDay = ({ year, month, day }: CalendarDateParts) => {
    const offset = Math.floor((14 - month) / 12)
    const adjustedYear = year + 4800 - offset
    const adjustedMonth = month + 12 * offset - 3
    return (
        day +
        Math.floor((153 * adjustedMonth + 2) / 5) +
        365 * adjustedYear +
        Math.floor(adjustedYear / 4) -
        Math.floor(adjustedYear / 100) +
        Math.floor(adjustedYear / 400) -
        32045
    )
}

const julianDayToGregorian = (julianDay: number): CalendarDateParts => {
    const offset = julianDay + 32044
    const century = Math.floor((4 * offset + 3) / 146097)
    const dayOfCentury = offset - Math.floor((146097 * century) / 4)
    const yearOfCentury = Math.floor((4 * dayOfCentury + 3) / 1461)
    const dayOfYear = dayOfCentury - Math.floor((1461 * yearOfCentury) / 4)
    const monthIndex = Math.floor((5 * dayOfYear + 2) / 153)
    return {
        day: dayOfYear - Math.floor((153 * monthIndex + 2) / 5) + 1,
        month: monthIndex + 3 - 12 * Math.floor(monthIndex / 10),
        year:
            100 * century + yearOfCentury - 4800 + Math.floor(monthIndex / 10),
    }
}

const epagomenalToJulianDay = (
    date: CalendarDateParts,
    calendar: EpagomenalCalendar
) =>
    EPAGOMENAL_EPOCHS[calendar] -
    1 +
    365 * (date.year - 1) +
    Math.floor(date.year / 4) +
    30 * (date.month - 1) +
    date.day

const julianDayToEpagomenal = (
    julianDay: number,
    calendar: EpagomenalCalendar
): CalendarDateParts => {
    const newYear = (year: number) =>
        epagomenalToJulianDay({ year, month: 1, day: 1 }, calendar)
    let year = Math.floor(
        (4 * (julianDay - EPAGOMENAL_EPOCHS[calendar]) + 1463) / 1461
    )
    while (julianDay < newYear(year)) {
        year -= 1
    }
    while (julianDay >= newYear(year + 1)) {
        year += 1
    }
    const dayOfYear = julianDay - newYear(year)
    return {
        year,
        month: Math.floor(dayOfYear / 30) + 1,
        day: (dayOfYear % 30) + 1,
    }
}

export const isValidCalendarDate = (
    parts: CalendarDateParts,
    calendar: Dhis2Calendar
) =>
    isEpagomenalCalendar(calendar)
        ? isValidEpagomenalDate(parts)
        : validateDateString(calendarDateString(parts), {
              calendar: toMultiCalendarIdentifier(calendar),
              strictValidation: true,
          }).valid

export const localDateToIso = (
    parts: CalendarDateParts,
    calendar: Dhis2Calendar
): CalendarDateParts => {
    if (isEpagomenalCalendar(calendar)) {
        return julianDayToGregorian(epagomenalToJulianDay(parts, calendar))
    }
    const { year, month, day } = convertToIso8601(
        calendarDateString(parts),
        toMultiCalendarIdentifier(calendar)
    )
    return { year, month, day }
}

export const isoDateToLocal = (
    parts: CalendarDateParts,
    calendar: Dhis2Calendar
): CalendarDateParts => {
    if (calendar === 'gregorian' || calendar === 'iso8601') {
        return parts
    }
    if (isEpagomenalCalendar(calendar)) {
        return julianDayToEpagomenal(gregorianToJulianDay(parts), calendar)
    }
    const converted = convertFromIso8601(
        calendarDateString(parts),
        toMultiCalendarIdentifier(calendar)
    )
    return {
        year: converted.eraYear ?? converted.year,
        month: converted.month,
        day: converted.day,
    }
}
