import type { Dhis2Calendar } from '@/components/dhis2-value-display'
import i18n from '@dhis2/d2-i18n'
import {
    addToCalendarDate,
    convertFromIso8601,
} from '@dhis2/multi-calendar-dates'

type CalendarDay = ReturnType<typeof convertFromIso8601>
type MultiCalendarIdentifier = Parameters<typeof convertFromIso8601>[1]

export interface Age {
    unit: 'days' | 'months' | 'years'
    count: number
}

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})/

const compare = (a: CalendarDay, b: CalendarDay) =>
    (a.eraYear ?? a.year) - (b.eraYear ?? b.year) ||
    a.month - b.month ||
    a.day - b.day

/** The user's local day as `YYYY-MM-DD`. */
export const todayIso = (now = new Date()) =>
    [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0'),
    ].join('-')

/**
 * Age on `today`, by the clinical convention: days under one month, months under two years, years after.
 * Undefined for an unreadable or future birth date, or a calendar the library cannot convert (Coptic).
 *
 * TODO(upstream): replace with the library's date difference once `@dhis2/multi-calendar-dates` has one
 * (draft issue: dhis2-blocks-plans/pr/2026-11-10-multi-calendar-age-issue.md).
 * shortcut: under two years, whole months are counted by adding them to the birth date with the library's
 * `addToCalendarDate` until the next would pass today; the library's clamping means a birth on the 31st turns
 * a month older on a shorter month's last day, and 29 February a year older on 28 February. Upgrade when
 * upstream settles both.
 */
export const ageOf = (
    birthIso: string,
    todayIsoDay: string,
    calendar: Dhis2Calendar
): Age | undefined => {
    const birthParts = ISO_DAY.exec(birthIso)
    const todayParts = ISO_DAY.exec(todayIsoDay)
    if (!birthParts || !todayParts) {
        return undefined
    }
    const days = Math.round(
        (Date.UTC(+todayParts[1], +todayParts[2] - 1, +todayParts[3]) -
            Date.UTC(+birthParts[1], +birthParts[2] - 1, +birthParts[3])) /
            86_400_000
    )
    if (Number.isNaN(days) || days < 0) {
        return undefined
    }
    // SAFETY: the library maps DHIS2's calendar names itself; its types list only the names it maps them to.
    const id = calendar as MultiCalendarIdentifier
    let birth: CalendarDay
    let today: CalendarDay
    try {
        birth = convertFromIso8601(birthParts[0], id)
        today = convertFromIso8601(todayParts[0], id)
    } catch {
        return undefined
    }
    const reached = (duration: { years?: number; months?: number }) =>
        compare(addToCalendarDate(birth, duration, id), today) <= 0
    const yearsApart =
        (today.eraYear ?? today.year) - (birth.eraYear ?? birth.year)
    // One fewer if this year's birthday has not come yet.
    const years = reached({ years: yearsApart }) ? yearsApart : yearsApart - 1
    if (years >= 2) {
        return { unit: 'years', count: years }
    }
    // Months per year differ by calendar (13 in Ethiopian) and the library does not say how many, so count them.
    let months = 0
    while (reached({ months: months + 1 })) {
        months += 1
    }
    return months >= 1
        ? { unit: 'months', count: months }
        : { unit: 'days', count: days }
}

export const formatAge = ({ unit, count }: Age): string => {
    switch (unit) {
        case 'years': // always two or more
            return i18n.t('{{count}} years', { count })
        case 'months':
            return count === 1
                ? i18n.t('1 month')
                : i18n.t('{{count}} months', { count })
        default:
            return count === 1
                ? i18n.t('1 day')
                : i18n.t('{{count}} days', { count })
    }
}
