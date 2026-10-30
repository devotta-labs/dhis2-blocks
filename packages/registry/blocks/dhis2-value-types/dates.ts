import { convertToIso8601 } from '@dhis2/multi-calendar-dates'
import {
    formatCalendarDate,
    isoFromCoptic,
    isoFromEthiopian,
    toMultiCalendarIdentifier,
} from '@/components/dhis2-value-display'
import type { Dhis2Calendar } from '@/components/dhis2-value-display'
import type { DateFormat, ValueSettings } from './types'

interface DateParts {
    year: number
    month: number
    day: number
}

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

/** A date on the system calendar as the ISO `yyyy-mm-dd`. */
const localToIso = (parts: DateParts, calendar: Dhis2Calendar): string => {
    if (calendar === 'gregorian' || calendar === 'iso8601') {
        return yearFirst(parts)
    }
    // Fixed arithmetic: the multi-calendar library's handling of these depends on the browser's ICU data.
    if (calendar === 'coptic') {
        return isoFromCoptic(parts)
    }
    if (calendar === 'ethiopian') {
        return isoFromEthiopian(parts)
    }
    const { year, month, day } = convertToIso8601(
        yearFirst(parts),
        toMultiCalendarIdentifier(calendar)
    )
    return yearFirst({ year, month, day })
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
        const iso = localToIso(parts, calendar)
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
