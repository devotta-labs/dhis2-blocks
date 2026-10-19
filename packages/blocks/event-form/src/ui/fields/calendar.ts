import {
    convertFromIso8601,
    convertToIso8601,
    validateDateString,
} from '@dhis2/multi-calendar-dates'
import type { SystemCalendar } from '../../api/schemas'

type DhisCalendar = SystemCalendar['calendar']
type DateFormat = SystemCalendar['dateFormat']
type MultiCalendarIdentifier = Parameters<typeof convertFromIso8601>[1]

interface DateParts {
    year: number
    month: number
    day: number
}

const pad = (value: number, length = 2) =>
    value.toString().padStart(length, '0')

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/

const parseDate = (value: string): DateParts | undefined => {
    const match = DATE.exec(value)
    return match === null
        ? undefined
        : {
              year: Number(match[1]),
              month: Number(match[2]),
              day: Number(match[3]),
          }
}

const formatDate = ({ year, month, day }: DateParts) =>
    `${pad(year, 4)}-${pad(month)}-${pad(day)}`

/** Normalises DHIS2's calendar names to the identifiers `@dhis2/multi-calendar-dates` understands. */
export const toMultiCalendarIdentifier = (
    calendar: DhisCalendar
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
        }) satisfies Record<DhisCalendar, MultiCalendarIdentifier>
    )[calendar]

const isGregorian = (calendar: DhisCalendar) =>
    calendar === 'gregorian' || calendar === 'iso8601'

/*
 * Coptic and Ethiopian dates are converted with day arithmetic: the library cannot resolve their
 * eras for every year, and it silently constrains an overflowing day. Ported from Working List's
 * transformers, which validates and converts the same way.
 */
const isEpagomenalCalendar = (
    calendar: DhisCalendar
): calendar is 'coptic' | 'ethiopian' =>
    calendar === 'coptic' || calendar === 'ethiopian'

const isValidEpagomenalDate = ({ year, month, day }: DateParts) =>
    year > 0 &&
    month >= 1 &&
    month <= 13 &&
    day >= 1 &&
    day <= (month <= 12 ? 30 : year % 4 === 3 ? 6 : 5)

const EPAGOMENAL_EPOCHS = {
    coptic: 1825030,
    ethiopian: 1724221,
} as const

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

const epagomenalToJulianDay = (
    date: DateParts,
    calendar: keyof typeof EPAGOMENAL_EPOCHS
) =>
    EPAGOMENAL_EPOCHS[calendar] -
    1 +
    365 * (date.year - 1) +
    Math.floor(date.year / 4) +
    30 * (date.month - 1) +
    date.day

const julianDayToEpagomenal = (
    julianDay: number,
    calendar: keyof typeof EPAGOMENAL_EPOCHS
): DateParts => {
    const epoch = EPAGOMENAL_EPOCHS[calendar]
    let year = Math.floor((4 * (julianDay - epoch) + 1463) / 1461)
    while (
        julianDay < epagomenalToJulianDay({ year, month: 1, day: 1 }, calendar)
    ) {
        year -= 1
    }
    while (
        julianDay >=
        epagomenalToJulianDay({ year: year + 1, month: 1, day: 1 }, calendar)
    ) {
        year += 1
    }
    const dayOfYear =
        julianDay - epagomenalToJulianDay({ year, month: 1, day: 1 }, calendar)
    return {
        year,
        month: Math.floor(dayOfYear / 30) + 1,
        day: (dayOfYear % 30) + 1,
    }
}

const isValidCalendarDate = (parts: DateParts, calendar: DhisCalendar) => {
    if (isEpagomenalCalendar(calendar)) {
        return isValidEpagomenalDate(parts)
    }
    return validateDateString(formatDate(parts), {
        calendar: toMultiCalendarIdentifier(calendar),
        strictValidation: true,
    }).valid
}

const convertLocalToIso = (
    parts: DateParts,
    calendar: DhisCalendar
): DateParts => {
    if (isEpagomenalCalendar(calendar)) {
        return julianDayToGregorian(epagomenalToJulianDay(parts, calendar))
    }
    const converted = convertToIso8601(
        formatDate(parts),
        toMultiCalendarIdentifier(calendar)
    )
    return { year: converted.year, month: converted.month, day: converted.day }
}

const convertIsoToLocal = (
    parts: DateParts,
    calendar: DhisCalendar
): DateParts => {
    if (isEpagomenalCalendar(calendar)) {
        return julianDayToEpagomenal(gregorianToJulianDay(parts), calendar)
    }
    const converted = convertFromIso8601(
        formatDate(parts),
        toMultiCalendarIdentifier(calendar)
    )
    return {
        year: converted.eraYear ?? converted.year,
        month: converted.month,
        day: converted.day,
    }
}

const isRealGregorianDate = ({ year, month, day }: DateParts) => {
    const date = new Date(Date.UTC(year, month - 1, day))
    return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
    )
}

/** A stored ISO date as `yyyy-MM-dd` in the system calendar. `undefined` for an invalid date. */
export const isoToCalendarDate = (
    iso: string,
    calendar: DhisCalendar
): string | undefined => {
    const parts = parseDate(iso)
    if (parts === undefined || !isRealGregorianDate(parts)) {
        return undefined
    }
    return isGregorian(calendar)
        ? iso
        : formatDate(convertIsoToLocal(parts, calendar))
}

/**
 * A `yyyy-MM-dd` date in the system calendar as an ISO date. `undefined` when the date does not
 * exist in that calendar, or would not convert back to itself.
 */
export const calendarDateToIso = (
    local: string,
    calendar: DhisCalendar
): string | undefined => {
    const parts = parseDate(local)
    if (parts === undefined) {
        return undefined
    }
    if (isGregorian(calendar)) {
        return isRealGregorianDate(parts) ? local : undefined
    }
    if (!isValidCalendarDate(parts, calendar)) {
        return undefined
    }
    const iso = convertLocalToIso(parts, calendar)
    const roundTrip = convertIsoToLocal(iso, calendar)
    return formatDate(roundTrip) === local ? formatDate(iso) : undefined
}

/** `yyyy-MM-dd` as the calendar input shows it, which is either order of day and year. */
export const canonicalDateToCalendarInput = (
    value: string | undefined,
    format: DateFormat
) => {
    if (!value || format === 'YYYY-MM-DD') {
        return value
    }
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
    return match ? `${match[3]}-${match[2]}-${match[1]}` : value
}

export const calendarInputDateToCanonical = (
    value: string | null | undefined,
    format: DateFormat
) => {
    if (!value || format === 'YYYY-MM-DD') {
        return value || undefined
    }
    const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value)
    return match ? `${match[3]}-${match[2]}-${match[1]}` : value
}

const addMonthsClamped = (
    { year, month, day }: DateParts,
    months: number
): Date => {
    const index = year * 12 + (month - 1) + months
    const targetYear = Math.floor(index / 12)
    const targetMonth = index % 12
    const lastDay = new Date(
        Date.UTC(targetYear, targetMonth + 1, 0)
    ).getUTCDate()
    return new Date(Date.UTC(targetYear, targetMonth, Math.min(day, lastDay)))
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Whole years, months and days from an ISO date of birth to an ISO date, counted in the
 * Gregorian calendar the values are stored in. `undefined` when either date is invalid or the
 * date is in the future.
 */
export const ageBetween = (
    birth: string,
    today: string
): { years: number; months: number; days: number } | undefined => {
    const from = parseDate(birth)
    const to = parseDate(today)
    if (
        from === undefined ||
        to === undefined ||
        !isRealGregorianDate(from) ||
        !isRealGregorianDate(to)
    ) {
        return undefined
    }
    const end = Date.UTC(to.year, to.month - 1, to.day)
    if (end < Date.UTC(from.year, from.month - 1, from.day)) {
        return undefined
    }
    let months = (to.year - from.year) * 12 + (to.month - from.month)
    if (addMonthsClamped(from, months).getTime() > end) {
        months -= 1
    }
    const days = Math.round(
        (end - addMonthsClamped(from, months).getTime()) / MS_PER_DAY
    )
    return { years: Math.floor(months / 12), months: months % 12, days }
}
