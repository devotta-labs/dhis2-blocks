import {
    isValidCalendarDate as isValidLocalDate,
    localDateToIso as localToIso,
    isoDateToLocal as isoToLocal,
    toMultiCalendarIdentifier as calendarIdentifier,
    type CalendarDateParts as DateParts,
} from '@/components/dhis2-value-display/calendarConversion'
import type {
    FinderCalendar,
    FinderDateFormat,
    FinderSystemInfo,
} from '../api/systemInfo'

export const toMultiCalendarIdentifier: (
    calendar: FinderCalendar
) => ReturnType<typeof calendarIdentifier> = calendarIdentifier

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
