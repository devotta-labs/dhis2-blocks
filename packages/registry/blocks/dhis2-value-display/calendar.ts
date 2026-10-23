import { convertFromIso8601 } from '@dhis2/multi-calendar-dates'
import type { Dhis2Calendar } from './types'

// Also exported here so a block can import the type from this file: a
// consumer's import rewriting resolves `./types` to the wrong block's.
export type { Dhis2Calendar }

type MultiCalendarIdentifier = Parameters<typeof convertFromIso8601>[1]

const CALENDARS: readonly Dhis2Calendar[] = [
    'coptic',
    'ethiopian',
    'gregorian',
    'islamic',
    'iso8601',
    'nepali',
    'persian',
    'thai',
]

/** The system calendar from `systemInfo.calendar`; anything unknown is Gregorian. */
// This is the parser: it takes the raw `systemInfo.calendar` and returns the domain type.
// oxlint-disable-next-line anti-slop/no-unknown-parameters
export const parseDhis2Calendar = (value: unknown): Dhis2Calendar =>
    CALENDARS.find((calendar) => calendar === value) ?? 'gregorian'

/**
 * Normalises DHIS2's server calendar names to the identifiers understood by
 * `@dhis2/multi-calendar-dates`.
 */
const toMultiCalendarIdentifier = (
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

const STORED_DAY = /^\d{4}-\d{2}-\d{2}/
const STORED_TIME = /^\d{4}-\d{2}-\d{2}T(\d{2}:\d{2})/

/** The `YYYY-MM-DD` prefix exactly as stored, never routed through `Date`. */
export const storedDay = (value: string): string | undefined =>
    STORED_DAY.exec(value)?.[0]

/** The `HH:mm` of a stored date-time exactly as written, or undefined. */
export const storedTime = (value: string): string | undefined =>
    STORED_TIME.exec(value)?.[1]

const pad = (value: number, length = 2) =>
    value.toString().padStart(length, '0')

/** Calendars `Intl` can name months for, so dates read as "Oct 14, 2026". */
const INTL_CALENDARS = new Set<Dhis2Calendar>(['gregorian', 'iso8601'])

/**
 * One formatter per locale: building one costs far more than formatting, and
 * the timeline formats a date per entry. `calendar: 'gregory'`, since `th` or
 * `fa` would otherwise switch to the Buddhist or Persian calendar.
 */
const dayFormats = new Map<string, Intl.DateTimeFormat>()

const dayFormat = (locale?: string): Intl.DateTimeFormat => {
    const known = dayFormats.get(locale ?? '')
    if (known !== undefined) {
        return known
    }
    const format = new Intl.DateTimeFormat(locale, {
        calendar: 'gregory',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
    })
    dayFormats.set(locale ?? '', format)
    return format
}

/** The Julian Day Number of a proleptic Gregorian date. */
const julianDayNumber = (year: number, month: number, day: number) => {
    const a = Math.floor((14 - month) / 12)
    const y = year + 4800 - a
    const m = month + 12 * a - 3
    return (
        day +
        Math.floor((153 * m + 2) / 5) +
        365 * y +
        Math.floor(y / 4) -
        Math.floor(y / 100) +
        Math.floor(y / 400) -
        32045
    )
}

/** The Julian Day Number of 1 Thout 1 AM, the first day of the Coptic calendar. */
const COPTIC_EPOCH = 1825030

/** Ethiopian years run 276 ahead of Coptic ones; months and days line up. */
const ETHIOPIAN_YEAR_OFFSET = 276

/**
 * A Gregorian `YYYY-MM-DD` as a Coptic or Ethiopian `YYYY-MM-DD`. Both have
 * twelve 30-day months and a thirteenth of 5 days (6 every fourth year), so
 * this is fixed arithmetic. Done here rather than through Intl, which some ICU
 * versions (Node 22.23, current Chromium) refuse for these calendars.
 */
const toCopticOrEthiopian = (
    day: string,
    calendar: 'coptic' | 'ethiopian'
): string | undefined => {
    const [year, month, date] = day.split('-').map(Number)
    if (year === undefined || month === undefined || date === undefined) {
        return undefined
    }
    const jdn = julianDayNumber(year, month, date)
    const copticYear = Math.floor((4 * (jdn - COPTIC_EPOCH) + 1463) / 1461)
    const newYear =
        COPTIC_EPOCH + 365 * (copticYear - 1) + Math.floor(copticYear / 4)
    const copticMonth = Math.floor((jdn - newYear) / 30) + 1
    const copticDay = jdn - newYear - 30 * (copticMonth - 1) + 1
    const shown =
        calendar === 'ethiopian'
            ? copticYear + ETHIOPIAN_YEAR_OFFSET
            : copticYear
    return `${pad(shown, 4)}-${pad(copticMonth)}-${pad(copticDay)}`
}

/**
 * A stored day in the system calendar: a short, locale-ordered date for the
 * Gregorian calendar, and `YYYY-MM-DD` for the others, whose month names `Intl`
 * lacks. The day is converted as written. An unreadable value is returned as is.
 */
export const formatCalendarDate = (
    isoDay: string,
    calendar: Dhis2Calendar,
    locale?: string
): string => {
    const day = storedDay(isoDay)
    if (day === undefined) {
        return isoDay
    }
    if (INTL_CALENDARS.has(calendar)) {
        const date = new Date(`${day}T00:00:00Z`)
        if (Number.isNaN(date.getTime())) {
            return day
        }
        try {
            return dayFormat(locale).format(date)
        } catch {
            return day
        }
    }
    if (calendar === 'coptic' || calendar === 'ethiopian') {
        return toCopticOrEthiopian(day, calendar) ?? day
    }
    try {
        const converted = convertFromIso8601(
            day,
            toMultiCalendarIdentifier(calendar)
        )
        const year = converted.eraYear ?? converted.year
        return `${pad(year, 4)}-${pad(converted.month)}-${pad(converted.day)}`
    } catch {
        return day
    }
}
