import { getDaysInMonth } from '@dhis2/multi-calendar-dates'
import { addDaysIso, addMonthsIso } from '@/components/dhis2-value-types'

export interface Age {
    years: number
    months: number
    days: number
}

const utc = (iso: string) => new Date(`${iso}T00:00:00Z`)

/** The days from `from` to `to`, which is less than a month on. */
// shortcut: counted here, as @dhis2/multi-calendar-dates has no difference in days; upgrade when it has one.
const daysBetween = (from: string, to: string) => {
    const [fromYear, fromMonth, fromDay] = from.split('-').map(Number)
    const [toYear, toMonth, toDay] = to.split('-').map(Number)
    return fromYear === toYear && fromMonth === toMonth
        ? toDay - fromDay
        : getDaysInMonth({ year: fromYear, month: fromMonth }, 'gregory') -
              fromDay +
              toDay
}

/** The whole years, months and days from a date of birth up to `today`, which is not before it. Both are `YYYY-MM-DD`. */
export const ageFromBirth = (birth: string, today: string): Age => {
    const from = utc(birth)
    const to = utc(today)
    // shortcut: months counted here, as @dhis2/multi-calendar-dates has no difference in days; upgrade when it has one.
    const spanned =
        (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
        to.getUTCMonth() -
        from.getUTCMonth()
    // The last month is whole once its day has come.
    const months = addMonthsIso(birth, spanned) > today ? spanned - 1 : spanned
    return {
        years: Math.floor(months / 12),
        months: months % 12,
        days: daysBetween(addMonthsIso(birth, months), today),
    }
}

/**
 * The date of birth of someone `age` old on `today`: the days back first, then the months, as `ageFromBirth` counts
 * them forward. Undefined when no one is that age today, as one month on 31 March: born 28 February, one is a month
 * and three days old.
 */
export const birthFromAge = (
    { years, months, days }: Age,
    today: string
): string | undefined => {
    const spanned = years * 12 + months
    const birth = addMonthsIso(addDaysIso(today, -days), -spanned)
    return addDaysIso(addMonthsIso(birth, spanned), days) === today
        ? birth
        : undefined
}
