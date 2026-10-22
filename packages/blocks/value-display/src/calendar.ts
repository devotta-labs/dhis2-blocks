import { convertFromIso8601 } from '@dhis2/multi-calendar-dates'
import type { Dhis2Calendar } from './types'

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
            return new Intl.DateTimeFormat(locale, {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                timeZone: 'UTC',
            }).format(date)
        } catch {
            return day
        }
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
