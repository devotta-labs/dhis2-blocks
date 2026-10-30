import {
    formatCalendarDate,
    isoFromCoptic,
    isoFromEthiopian,
} from '@/components/dhis2-value-display'
import { completionExpired, expiryStart } from './expiry'

test('an expiry period starts with the period that holds today less the expiry days', () => {
    expect(expiryStart('Monthly', 1, '2026-10-26', 'gregorian')).toBe(
        '2026-10-01'
    )
    expect(expiryStart('Monthly', 1, '2026-10-01', 'gregorian')).toBe(
        '2026-09-01'
    )
    expect(expiryStart('Monthly', 0, '2026-10-01', 'gregorian')).toBe(
        '2026-10-01'
    )
    expect(expiryStart('Monthly', undefined, '2026-10-01', 'gregorian')).toBe(
        '2026-10-01'
    )
    expect(expiryStart('Daily', 3, '2026-03-02', 'gregorian')).toBe(
        '2026-02-27'
    )
    expect(expiryStart('Weekly', 0, '2026-10-25', 'gregorian')).toBe(
        '2026-10-19'
    )
    expect(expiryStart('WeeklySunday', 0, '2026-10-25', 'gregorian')).toBe(
        '2026-10-25'
    )
    expect(expiryStart('BiWeekly', 0, '2026-10-25', 'gregorian')).toBe(
        '2026-10-19'
    )
    expect(expiryStart('Quarterly', 30, '2026-10-25', 'gregorian')).toBe(
        '2026-07-01'
    )
    expect(expiryStart('SixMonthlyApril', 0, '2026-10-25', 'gregorian')).toBe(
        '2026-10-01'
    )
    expect(expiryStart('FinancialNov', 0, '2026-10-25', 'gregorian')).toBe(
        '2025-11-01'
    )
})

test('an expiry period starts on the first day of the system calendar’s period', () => {
    // Ethiopian 2019-02-01; the same day as Coptic 1743-02-01.
    expect(expiryStart('Monthly', 0, '2026-10-30', 'ethiopian')).toBe(
        '2026-10-11'
    )
    expect(expiryStart('Monthly', 0, '2026-10-30', 'coptic')).toBe('2026-10-11')
    // The expiry days are taken off before the month is found: 2026-10-05 is Ethiopian 2019-01-25.
    expect(expiryStart('Monthly', 25, '2026-10-30', 'ethiopian')).toBe(
        '2026-09-11'
    )
    // Periods counted from month 1 end by 12-30, so Pagume opens on Pagume 1: 2027-09-08 is Ethiopian 2019-13-03.
    expect(expiryStart('Monthly', 0, '2027-09-08', 'ethiopian')).toBe(
        '2027-09-06'
    )
    expect(expiryStart('Yearly', 0, '2027-09-08', 'ethiopian')).toBe(
        '2027-09-06'
    )
    // Nepali 2083 begins on 14 April 2026, and Baisakh, Jestha, Asar and Shrawan hold 31, 31, 32 and 31 days: Bhadra
    // starts 125 days on, 17 August.
    expect(expiryStart('Monthly', 0, '2026-08-30', 'nepali')).toBe('2026-08-17')
    // ISO 8601 counts the Gregorian months.
    expect(expiryStart('Monthly', 0, '2026-10-30', 'iso8601')).toBe(
        '2026-10-01'
    )
})

test('Ethiopian and Coptic periods start in the same month number as the Gregorian ones, in the matching year', () => {
    const monthBased = [
        'Monthly',
        'BiMonthly',
        'Quarterly',
        'QuarterlyNov',
        'SixMonthly',
        'SixMonthlyApril',
        'SixMonthlyNov',
        'Yearly',
        'FinancialApril',
        'FinancialJuly',
        'FinancialSep',
        'FinancialOct',
        'FinancialNov',
    ]
    const calendars = [
        { calendar: 'ethiopian', year: 2019, toIso: isoFromEthiopian },
        { calendar: 'coptic', year: 1743, toIso: isoFromCoptic },
    ] as const
    const parts = (day: string | undefined) => day?.split('-').map(Number)
    for (const periodType of monthBased) {
        for (let month = 1; month <= 12; month++) {
            const [year, start] =
                parts(
                    expiryStart(
                        periodType,
                        0,
                        `2026-${String(month).padStart(2, '0')}-10`,
                        'gregorian'
                    )
                ) ?? []
            for (const { calendar, year: base, toIso } of calendars) {
                const day = toIso({ year: base, month, day: 10 })
                const [localYear, localMonth] =
                    parts(
                        formatCalendarDate(
                            expiryStart(periodType, 0, day, calendar) ?? '',
                            calendar
                        )
                    ) ?? []
                expect(
                    [localYear - base, localMonth],
                    `${periodType} in month ${month} of ${calendar}`
                ).toEqual([year - 2026, start])
            }
        }
    }
})

test('weeks run on the same days in every calendar, and Ethiopian and Coptic two-week periods are not worked out', () => {
    expect(expiryStart('Weekly', 0, '2026-10-25', 'ethiopian')).toBe(
        '2026-10-19'
    )
    expect(expiryStart('WeeklySunday', 0, '2026-10-25', 'coptic')).toBe(
        '2026-10-25'
    )
    expect(expiryStart('Daily', 3, '2026-03-02', 'ethiopian')).toBe(
        '2026-02-27'
    )
    expect(
        expiryStart('BiWeekly', 0, '2026-10-25', 'ethiopian')
    ).toBeUndefined()
})

test('every period type DHIS2 offers for expiry has a start', () => {
    const periodTypes = [
        'Daily',
        'Weekly',
        'WeeklyWednesday',
        'WeeklyThursday',
        'WeeklySaturday',
        'WeeklySunday',
        'BiWeekly',
        'Monthly',
        'BiMonthly',
        'Quarterly',
        'QuarterlyNov',
        'SixMonthly',
        'SixMonthlyApril',
        'SixMonthlyNov',
        'Yearly',
        'FinancialApril',
        'FinancialJuly',
        'FinancialSep',
        'FinancialOct',
        'FinancialNov',
    ]
    for (const periodType of periodTypes) {
        expect(expiryStart(periodType, 0, '2026-10-25', 'gregorian')).toMatch(
            /^\d{4}-\d{2}-\d{2}$/
        )
    }
})

test('no period type, or one it does not know, never expires', () => {
    expect(
        expiryStart(undefined, 10, '2026-10-25', 'gregorian')
    ).toBeUndefined()
    expect(
        expiryStart('TwoYearly', 10, '2026-10-25', 'gregorian')
    ).toBeUndefined()
})

test('a date the calendar library cannot convert never expires', () => {
    // The library converts Nepali dates of 1970 to 2100 BS only.
    expect(expiryStart('Monthly', 0, '2300-01-01', 'nepali')).toBeUndefined()
})

test('a completed event expires the given number of days after completion', () => {
    const completedAt = '2026-10-19T15:30:00.000'
    expect(completionExpired(completedAt, 7, '2026-10-25')).toBe(false)
    expect(completionExpired(completedAt, 7, '2026-10-26')).toBe(true)
    expect(completionExpired(completedAt, 0, '2027-10-26')).toBe(false)
    expect(completionExpired(completedAt, undefined, '2027-10-26')).toBe(false)
    expect(completionExpired(undefined, 7, '2027-10-26')).toBe(false)
})
