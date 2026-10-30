import {
    convertFromIso8601,
    convertToIso8601,
    validateDateString,
} from '@dhis2/multi-calendar-dates'
import type {
    FinderCalendar,
    FinderDateFormat,
    FinderSystemInfo,
} from '../api/systemInfo'

type MultiCalendarIdentifier = Parameters<typeof convertFromIso8601>[1]

/** DHIS2's calendar names as `@dhis2/multi-calendar-dates` and CalendarInput know them. */
export const toMultiCalendarIdentifier = (
    calendar: FinderCalendar
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
        }) satisfies Record<FinderCalendar, MultiCalendarIdentifier>
    )[calendar]

interface DateParts {
    year: number
    month: number
    day: number
}

const pad = (value: number, length = 2) =>
    value.toString().padStart(length, '0')

const toYearFirst = ({ year, month, day }: DateParts) =>
    `${pad(year, 4)}-${pad(month)}-${pad(day)}`

const toSystemFormat = (parts: DateParts, format: FinderDateFormat) =>
    format === 'DD-MM-YYYY'
        ? `${pad(parts.day)}-${pad(parts.month)}-${pad(parts.year, 4)}`
        : toYearFirst(parts)

const PATTERNS = {
    'YYYY-MM-DD': /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})$/,
    'DD-MM-YYYY': /^(?<day>\d{2})-(?<month>\d{2})-(?<year>\d{4})$/,
} satisfies Record<FinderDateFormat, RegExp>

const parseDate = (
    value: string,
    format: FinderDateFormat
): DateParts | undefined => {
    const groups = PATTERNS[format].exec(value.trim())?.groups
    return groups
        ? {
              year: Number(groups.year),
              month: Number(groups.month),
              day: Number(groups.day),
          }
        : undefined
}

const isRealIsoDate = ({ year, month, day }: DateParts) => {
    const date = new Date(Date.UTC(year, month - 1, day))
    return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
    )
}

// The Ethiopian and Coptic calendars have twelve 30-day months and a short
// 13th (Pagume / Nasie). Temporal's era handling for them is unreliable, so,
// as working-list does, they convert through the Julian day number.
const EPAGOMENAL_EPOCHS = {
    coptic: 1825030,
    ethiopian: 1724221,
} as const

type EpagomenalCalendar = keyof typeof EPAGOMENAL_EPOCHS

const isEpagomenal = (
    calendar: FinderCalendar
): calendar is EpagomenalCalendar =>
    calendar === 'coptic' || calendar === 'ethiopian'

const epagomenalDays = (year: number) => (year % 4 === 3 ? 6 : 5)

const isValidEpagomenalDate = ({ year, month, day }: DateParts) =>
    year > 0 &&
    month >= 1 &&
    month <= 13 &&
    day >= 1 &&
    day <= (month <= 12 ? 30 : epagomenalDays(year))

const gregorianToJulianDay = ({ year, month, day }: DateParts) => {
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

const julianDayToGregorian = (julianDay: number): DateParts => {
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

const epagomenalToJulianDay = (date: DateParts, calendar: EpagomenalCalendar) =>
    EPAGOMENAL_EPOCHS[calendar] -
    1 +
    365 * (date.year - 1) +
    Math.floor(date.year / 4) +
    30 * (date.month - 1) +
    date.day

const julianDayToEpagomenal = (
    julianDay: number,
    calendar: EpagomenalCalendar
): DateParts => {
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

const isValidLocalDate = (parts: DateParts, calendar: FinderCalendar) =>
    isEpagomenal(calendar)
        ? isValidEpagomenalDate(parts)
        : validateDateString(toYearFirst(parts), {
              calendar: toMultiCalendarIdentifier(calendar),
              strictValidation: true,
          }).valid

const localToIso = (parts: DateParts, calendar: FinderCalendar): DateParts => {
    if (isEpagomenal(calendar)) {
        return julianDayToGregorian(epagomenalToJulianDay(parts, calendar))
    }
    const { year, month, day } = convertToIso8601(
        toYearFirst(parts),
        toMultiCalendarIdentifier(calendar)
    )
    return { year, month, day }
}

const isoToLocal = (parts: DateParts, calendar: FinderCalendar): DateParts => {
    if (calendar === 'gregorian' || calendar === 'iso8601') {
        return parts
    }
    if (isEpagomenal(calendar)) {
        return julianDayToEpagomenal(gregorianToJulianDay(parts), calendar)
    }
    const converted = convertFromIso8601(
        toYearFirst(parts),
        toMultiCalendarIdentifier(calendar)
    )
    return {
        year: converted.eraYear ?? converted.year,
        month: converted.month,
        day: converted.day,
    }
}

/**
 * Reads a date typed on the system calendar, in the system date format, as
 * the ISO `yyyy-mm-dd` the server searches by. A date that does not exist on
 * that calendar, or that does not convert back to itself, is `undefined`, so
 * a wrong date is never sent.
 */
export const calendarDateToIso = (
    value: string,
    { calendar, dateFormat }: FinderSystemInfo
): string | undefined => {
    const parts = parseDate(value, dateFormat)
    if (!parts) {
        return undefined
    }
    try {
        if (!isValidLocalDate(parts, calendar)) {
            return undefined
        }
        const iso = localToIso(parts, calendar)
        const back = isoToLocal(iso, calendar)
        return toYearFirst(back) === toYearFirst(parts)
            ? toYearFirst(iso)
            : undefined
    } catch {
        return undefined
    }
}

/** Whether the (trimmed) text is a real ISO `yyyy-mm-dd` date. */
export const isIsoDate = (value: string) => {
    const parts = parseDate(value, 'YYYY-MM-DD')
    return parts !== undefined && isRealIsoDate(parts)
}

/**
 * Shows an ISO `yyyy-mm-dd` date on the system calendar, in the system date
 * format. Anything that is not a real ISO date comes back unchanged.
 */
export const isoToCalendarDate = (
    iso: string,
    { calendar, dateFormat }: FinderSystemInfo
): string => {
    const parts = parseDate(iso, 'YYYY-MM-DD')
    if (!parts || !isRealIsoDate(parts)) {
        return iso
    }
    try {
        return toSystemFormat(isoToLocal(parts, calendar), dateFormat)
    } catch {
        return iso
    }
}
