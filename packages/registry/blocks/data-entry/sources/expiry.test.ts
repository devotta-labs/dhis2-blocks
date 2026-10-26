import { completionExpired, expiryStart } from './expiry'

test('an expiry period starts with the period that holds today less the expiry days', () => {
    expect(expiryStart('Monthly', 1, '2026-10-26')).toBe('2026-10-01')
    expect(expiryStart('Monthly', 1, '2026-10-01')).toBe('2026-09-01')
    expect(expiryStart('Monthly', 0, '2026-10-01')).toBe('2026-10-01')
    expect(expiryStart('Monthly', undefined, '2026-10-01')).toBe('2026-10-01')
    expect(expiryStart('Daily', 3, '2026-03-02')).toBe('2026-02-27')
    expect(expiryStart('Weekly', 0, '2026-10-25')).toBe('2026-10-19')
    expect(expiryStart('WeeklySunday', 0, '2026-10-25')).toBe('2026-10-25')
    expect(expiryStart('BiWeekly', 0, '2026-10-25')).toBe('2026-10-19')
    expect(expiryStart('Quarterly', 30, '2026-10-25')).toBe('2026-07-01')
    expect(expiryStart('SixMonthlyApril', 0, '2026-10-25')).toBe('2026-10-01')
    expect(expiryStart('FinancialNov', 0, '2026-10-25')).toBe('2025-11-01')
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
        expect(expiryStart(periodType, 0, '2026-10-25')).toMatch(
            /^\d{4}-\d{2}-\d{2}$/
        )
    }
})

test('no period type, or one it does not know, never expires', () => {
    expect(expiryStart(undefined, 10, '2026-10-25')).toBeUndefined()
    expect(expiryStart('TwoYearly', 10, '2026-10-25')).toBeUndefined()
})

test('a completed event expires the given number of days after completion', () => {
    const completedAt = '2026-10-19T15:30:00.000'
    expect(completionExpired(completedAt, 7, '2026-10-25')).toBe(false)
    expect(completionExpired(completedAt, 7, '2026-10-26')).toBe(true)
    expect(completionExpired(completedAt, 0, '2027-10-26')).toBe(false)
    expect(completionExpired(completedAt, undefined, '2027-10-26')).toBe(false)
    expect(completionExpired(undefined, 7, '2027-10-26')).toBe(false)
})
