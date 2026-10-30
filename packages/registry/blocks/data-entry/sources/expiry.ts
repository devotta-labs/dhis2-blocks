import {
    convertFromIso8601,
    convertToIso8601,
    getFixedPeriodByDate,
} from '@dhis2/multi-calendar-dates'
import {
    formatCalendarDate,
    isoFromCoptic,
    isoFromEthiopian,
    toMultiCalendarIdentifier,
} from '@/components/dhis2-value-display'
import type { Dhis2Calendar } from '@/components/dhis2-value-display'

type PeriodType = Parameters<typeof getFixedPeriodByDate>[0]['periodType']

/** The period types DHIS2 offers for a program's expiry, by the id `@dhis2/multi-calendar-dates` gives them. */
const PERIOD_TYPES = new Map<string, PeriodType>([
    ['Daily', 'DAILY'],
    ['Weekly', 'WEEKLY'],
    ['WeeklyWednesday', 'WEEKLYWED'],
    ['WeeklyThursday', 'WEEKLYTHU'],
    ['WeeklySaturday', 'WEEKLYSAT'],
    ['WeeklySunday', 'WEEKLYSUN'],
    ['BiWeekly', 'BIWEEKLY'],
    ['Monthly', 'MONTHLY'],
    ['BiMonthly', 'BIMONTHLY'],
    ['Quarterly', 'QUARTERLY'],
    ['QuarterlyNov', 'QUARTERLYNOV'],
    ['SixMonthly', 'SIXMONTHLY'],
    ['SixMonthlyApril', 'SIXMONTHLYAPR'],
    ['SixMonthlyNov', 'SIXMONTHLYNOV'],
    ['Yearly', 'YEARLY'],
    ['FinancialApril', 'FYAPR'],
    ['FinancialJuly', 'FYJUL'],
    ['FinancialSep', 'FYSEP'],
    ['FinancialOct', 'FYOCT'],
    ['FinancialNov', 'FYNOV'],
])

/** The device's date as `YYYY-MM-DD`. */
export const localToday = () => {
    const now = new Date()
    return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
        .toISOString()
        .slice(0, 10)
}

/** `YYYY-MM-DD` plus `days`; in UTC, so no daylight saving shift moves the date. */
export const addDays = (date: string, days: number) =>
    new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000)
        .toISOString()
        .slice(0, 10)

/** How many months a period of each month-based type holds, and the month of the year its count starts from. */
const MONTH_PERIODS = new Map<
    PeriodType,
    readonly [months: number, first: number]
>([
    ['MONTHLY', [1, 1]],
    ['BIMONTHLY', [2, 1]],
    ['QUARTERLY', [3, 1]],
    ['QUARTERLYNOV', [3, 11]],
    ['SIXMONTHLY', [6, 1]],
    ['SIXMONTHLYAPR', [6, 4]],
    ['SIXMONTHLYNOV', [6, 11]],
    ['YEARLY', [12, 1]],
    ['FYAPR', [12, 4]],
    ['FYJUL', [12, 7]],
    ['FYSEP', [12, 9]],
    ['FYOCT', [12, 10]],
    ['FYNOV', [12, 11]],
])

const pad = (value: number, length = 2) =>
    value.toString().padStart(length, '0')

const dayOf = ({
    year,
    month,
    day,
}: {
    year: number
    month: number
    day: number
}) => `${pad(year, 4)}-${pad(month)}-${pad(day)}`

/**
 * The start of the period holding `iso` on the Coptic or Ethiopian calendar (twelve 30-day months and a short 13th), by
 * fixed arithmetic: the library's handling of both depends on the browser's ICU data and fails on current versions.
 * Weeks run on the same days in every calendar; a month-based period starts a whole number of its lengths on from the
 * month its count begins in. DHIS2 expires an event once its period has ended, and its calendar-year periods end on
 * 12-30 (twelve 30-day months), so a reference date in Pagume opens on Pagume 1.
 */
const fixedCalendarStart = (
    iso: string,
    periodType: PeriodType,
    calendar: 'coptic' | 'ethiopian'
): string | undefined => {
    const months = MONTH_PERIODS.get(periodType)
    if (months === undefined) {
        // shortcut: a two-week period counts from its calendar's new year, which is not worked out here, so it never
        // expires; upgrade when an Ethiopian or Coptic server uses one.
        return periodType === 'BIWEEKLY'
            ? undefined
            : getFixedPeriodByDate({
                  periodType,
                  date: iso,
                  calendar: 'gregory',
              }).startDate
    }
    const [length, first] = months
    const [year, month] = formatCalendarDate(iso, calendar)
        .split('-')
        .map(Number)
    const since = month >= first ? month - first : month - first + 12
    // A period counted from month 1 has ended by Pagume (month 13), which opens on its own first day.
    const startMonth = month - (since % length)
    const start =
        startMonth < 1
            ? { year: year - 1, month: startMonth + 12, day: 1 }
            : { year, month: startMonth, day: 1 }
    return calendar === 'coptic'
        ? isoFromCoptic(start)
        : isoFromEthiopian(start)
}

/**
 * The first event date still open on `today` (`YYYY-MM-DD`): the start of the period that holds `today` less
 * `expiryDays`, in the server's `calendar`, as DHIS2 builds it. Undefined when nothing expires, including a period
 * type it does not know, so such a type never makes an event read-only.
 */
export const expiryStart = (
    periodType: string | undefined,
    expiryDays: number | undefined,
    today: string,
    calendar: Dhis2Calendar
): string | undefined => {
    const id =
        periodType === undefined ? undefined : PERIOD_TYPES.get(periodType)
    if (id === undefined) {
        return undefined
    }
    const date = addDays(today, -(expiryDays ?? 0))
    if (calendar === 'coptic' || calendar === 'ethiopian') {
        return fixedCalendarStart(date, id, calendar)
    }
    if (calendar === 'gregorian' || calendar === 'iso8601') {
        return getFixedPeriodByDate({
            periodType: id,
            date,
            calendar: 'gregory',
        }).startDate
    }
    const identifier = toMultiCalendarIdentifier(calendar)
    try {
        const { eraYear, year, month, day } = convertFromIso8601(
            date,
            identifier
        )
        const { startDate } = getFixedPeriodByDate({
            periodType: id,
            date: dayOf({ year: eraYear ?? year, month, day }),
            calendar: identifier,
        })
        return dayOf(convertToIso8601(startDate, identifier))
    } catch {
        // A date the library cannot convert expires nothing here: the server still refuses expired events.
        return undefined
    }
}

/** Whether an event completed at `completedAt` is closed on `today`, `days` after it was completed. */
export const completionExpired = (
    completedAt: string | undefined,
    days: number | undefined,
    today: string
): boolean =>
    days !== undefined &&
    days > 0 &&
    completedAt !== undefined &&
    today >= addDays(completedAt.slice(0, 10), days)
