import { convertToIso8601 } from '@dhis2/multi-calendar-dates'
import { formatCalendarDate } from '@/components/dhis2-value-display'
import type { Dhis2Calendar } from '@/components/dhis2-value-display'
import type { DateFormat, ValueSettings } from './types'

type MultiCalendarIdentifier = Parameters<typeof convertToIso8601>[1]

interface DateParts {
    year: number
    month: number
    day: number
}

/** DHIS2's calendar names as `@dhis2/multi-calendar-dates` knows them. */
const MULTI_CALENDARS = {
    coptic: 'coptic',
    ethiopian: 'ethiopic',
    gregorian: 'gregory',
    islamic: 'islamic',
    iso8601: 'iso8601',
    nepali: 'nepali',
    persian: 'persian',
    thai: 'buddhist',
} satisfies Record<Dhis2Calendar, MultiCalendarIdentifier>

/** The date format from `systemInfo.dateFormat`; anything but day first is year first. */
export const parseDateFormat = (systemInfoDateFormat: string): DateFormat =>
    systemInfoDateFormat.toLowerCase() === 'dd-mm-yyyy'
        ? 'DD-MM-YYYY'
        : 'YYYY-MM-DD'

const pad = (value: number, length = 2) =>
    value.toString().padStart(length, '0')

const yearFirst = ({ year, month, day }: DateParts) =>
    `${pad(year, 4)}-${pad(month)}-${pad(day)}`

const PATTERNS = {
    'YYYY-MM-DD': /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})$/,
    'DD-MM-YYYY': /^(?<day>\d{2})-(?<month>\d{2})-(?<year>\d{4})$/,
} satisfies Record<DateFormat, RegExp>

const partsOf = (text: string, format: DateFormat): DateParts | undefined => {
    const groups = PATTERNS[format].exec(text)?.groups
    return groups
        ? {
              year: Number(groups.year),
              month: Number(groups.month),
              day: Number(groups.day),
          }
        : undefined
}

/** Whether the text is a real ISO `yyyy-mm-dd` date. */
export const isIsoDate = (text: string): boolean => {
    const parts = partsOf(text, 'YYYY-MM-DD')
    if (parts === undefined) {
        return false
    }
    const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
    return (
        date.getUTCFullYear() === parts.year &&
        date.getUTCMonth() === parts.month - 1 &&
        date.getUTCDate() === parts.day
    )
}

/** The Julian Day Number of 1 Thout 1 AM, the first day of the Coptic calendar. */
const COPTIC_EPOCH = 1825030
/** Ethiopian years run 276 ahead of Coptic ones; months and days line up. */
const ETHIOPIAN_YEAR_OFFSET = 276

/**
 * A Coptic or Ethiopian date as a Gregorian one, by fixed arithmetic: both
 * have twelve 30-day months and a short thirteenth, and the multi-calendar
 * library's handling of them depends on the browser's ICU data. A date the
 * calendar does not have still lands on some day; the caller converts that day
 * back to catch it.
 */
const copticOrEthiopianToIso = (
    { year, month, day }: DateParts,
    calendar: 'coptic' | 'ethiopian'
): DateParts => {
    const copticYear =
        calendar === 'ethiopian' ? year - ETHIOPIAN_YEAR_OFFSET : year
    const julianDay =
        COPTIC_EPOCH -
        1 +
        365 * (copticYear - 1) +
        Math.floor(copticYear / 4) +
        30 * (month - 1) +
        day
    const offset = julianDay + 32044
    const century = Math.floor((4 * offset + 3) / 146097)
    const dayOfCentury = offset - Math.floor((146097 * century) / 4)
    const yearOfCentury = Math.floor((4 * dayOfCentury + 3) / 1461)
    const dayOfYear = dayOfCentury - Math.floor((1461 * yearOfCentury) / 4)
    const monthIndex = Math.floor((5 * dayOfYear + 2) / 153)
    return {
        year:
            100 * century + yearOfCentury - 4800 + Math.floor(monthIndex / 10),
        month: monthIndex + 3 - 12 * Math.floor(monthIndex / 10),
        day: dayOfYear - Math.floor((153 * monthIndex + 2) / 5) + 1,
    }
}

const localToIso = (parts: DateParts, calendar: Dhis2Calendar): DateParts => {
    if (calendar === 'gregorian' || calendar === 'iso8601') {
        return parts
    }
    if (calendar === 'coptic' || calendar === 'ethiopian') {
        return copticOrEthiopianToIso(parts, calendar)
    }
    const { year, month, day } = convertToIso8601(
        yearFirst(parts),
        MULTI_CALENDARS[calendar]
    )
    return { year, month, day }
}

/** An ISO day as the `YYYY-MM-DD` of the system calendar. */
const isoToLocal = (iso: string, calendar: Dhis2Calendar): string =>
    calendar === 'gregorian' || calendar === 'iso8601'
        ? iso
        : formatCalendarDate(iso, calendar)

/**
 * A date typed on the system calendar in the system date format, as the ISO
 * `yyyy-mm-dd` DHIS2 stores. A date the calendar does not have, or that does
 * not convert back to itself, is `undefined`, so a wrong day is never stored.
 */
export const calendarDateToIso = (
    text: string,
    { calendar, dateFormat }: ValueSettings
): string | undefined => {
    const parts = partsOf(text, dateFormat)
    if (parts === undefined) {
        return undefined
    }
    try {
        const iso = yearFirst(localToIso(parts, calendar))
        return isIsoDate(iso) && isoToLocal(iso, calendar) === yearFirst(parts)
            ? iso
            : undefined
    } catch {
        return undefined
    }
}

/** A stored ISO day as typed on the system calendar; anything else comes back unchanged. */
export const isoToCalendarDate = (
    iso: string,
    { calendar, dateFormat }: ValueSettings
): string => {
    if (!isIsoDate(iso)) {
        return iso
    }
    const parts = partsOf(isoToLocal(iso, calendar), 'YYYY-MM-DD')
    if (parts === undefined) {
        return iso
    }
    return dateFormat === 'DD-MM-YYYY'
        ? `${pad(parts.day)}-${pad(parts.month)}-${pad(parts.year, 4)}`
        : yearFirst(parts)
}
