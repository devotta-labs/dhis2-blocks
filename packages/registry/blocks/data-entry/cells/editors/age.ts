import { addDays } from '../../sources/expiry'

export interface Age {
    years: number
    months: number
    days: number
}

const MS_PER_DAY = 86_400_000

const utc = (iso: string) => new Date(`${iso}T00:00:00Z`)

/** `YYYY-MM-DD` moved by `months` (back when negative); a day the month lacks becomes its last day. */
const addMonths = (iso: string, months: number) => {
    const date = utc(iso)
    const day = date.getUTCDate()
    // From the first, so no month overflows; day 0 of the month after is the last day of the one wanted.
    date.setUTCDate(1)
    date.setUTCMonth(date.getUTCMonth() + months + 1, 0)
    date.setUTCDate(Math.min(day, date.getUTCDate()))
    return date.toISOString().slice(0, 10)
}

/** The whole years, months and days from a date of birth up to `today`, which is not before it. Both are `YYYY-MM-DD`. */
export const ageFromBirth = (birth: string, today: string): Age => {
    const from = utc(birth)
    const to = utc(today)
    const spanned =
        (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
        to.getUTCMonth() -
        from.getUTCMonth()
    // The last month is whole once its day has come.
    const months = addMonths(birth, spanned) > today ? spanned - 1 : spanned
    return {
        years: Math.floor(months / 12),
        months: months % 12,
        days:
            (to.getTime() - utc(addMonths(birth, months)).getTime()) /
            MS_PER_DAY,
    }
}

/** The date of birth of someone `age` old on `today`: the days back first, then the months, so `ageFromBirth` counts it again. */
export const birthFromAge = (
    { years, months, days }: Age,
    today: string
): string => addMonths(addDays(today, -days), -(years * 12 + months))
