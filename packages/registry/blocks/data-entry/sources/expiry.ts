import { getFixedPeriodByDate } from '@dhis2/multi-calendar-dates'

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

/**
 * The first event date still open on `today` (`YYYY-MM-DD`): the start of the period that holds `today` less
 * `expiryDays`. Undefined when nothing expires, including a period type it does not know, so such a type never
 * makes an event read-only.
 */
export const expiryStart = (
    periodType: string | undefined,
    expiryDays: number | undefined,
    today: string
): string | undefined => {
    const id =
        periodType === undefined ? undefined : PERIOD_TYPES.get(periodType)
    return id === undefined
        ? undefined
        : getFixedPeriodByDate({
              periodType: id,
              date: addDays(today, -(expiryDays ?? 0)),
              calendar: 'gregory',
          }).startDate
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
