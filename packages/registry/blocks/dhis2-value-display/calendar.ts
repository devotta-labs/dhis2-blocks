import {
    convertFromIso8601,
    formatCalendarDate as formatLibraryDate,
} from '@dhis2/multi-calendar-dates'
import type { Dhis2Calendar } from './types'

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

// oxlint-disable-next-line anti-slop/no-unknown-parameters
export const parseDhis2Calendar = (value: unknown) =>
    CALENDARS.find((calendar) => calendar === value) ?? 'gregorian'

const STORED_DAY = /^\d{4}-\d{2}-\d{2}/
const STORED_TIME = /^\d{4}-\d{2}-\d{2}[T ](\d{2}:\d{2})/

/** The `YYYY-MM-DD` prefix exactly as stored, never routed through `Date`. */
export const storedDay = (value: string) => STORED_DAY.exec(value)?.[0]

/** The `HH:mm` of a stored date-time exactly as written, or undefined. */
export const storedTime = (value: string) => STORED_TIME.exec(value)?.[1]

const INTL_CALENDARS = new Set<Dhis2Calendar>(['gregorian', 'iso8601'])

const dayFormats = new Map<string, Intl.DateTimeFormat>()

const dayFormat = (locale?: string) => {
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

/**
 * A stored day in the system calendar: a short, locale-ordered date for the
 * Gregorian calendar, and `YYYY-MM-DD` for the others, whose month names `Intl`
 * lacks. The day is converted as written. An unreadable value is returned as is.
 */
export const formatCalendarDate = (
    isoDay: string,
    calendar: Dhis2Calendar,
    locale?: string
) => {
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
    try {
        // SAFETY: the library maps DHIS2's calendar names itself; its types list only the names it maps them to.
        return formatLibraryDate(
            convertFromIso8601(day, calendar as MultiCalendarIdentifier)
        )
    } catch {
        return day
    }
}
