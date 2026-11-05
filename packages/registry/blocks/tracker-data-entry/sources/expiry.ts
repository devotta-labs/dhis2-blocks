import { getFixedPeriodByDate } from '@dhis2/multi-calendar-dates'
import type { Dhis2Calendar } from '@/components/dhis2-value-display'
import { addDaysIso } from '@/components/dhis2-value-types'

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
    // shortcut: other calendars expire nothing here (the server still refuses expired events), as the calendar
    // library's periods differ from DHIS2's for some of them; upgrade when its periods match the server's.
    if (calendar !== 'gregorian' && calendar !== 'iso8601') {
        return undefined
    }
    return getFixedPeriodByDate({
        periodType: id,
        date: addDaysIso(today, -(expiryDays ?? 0)),
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
    today >= addDaysIso(completedAt.slice(0, 10), days)
