import { dayDifference, isoDay } from './dates'

// Daylight saving starts on 29 March 2026 here.
process.env.TZ = 'Europe/Oslo'

test('isoDay of a local date', () => {
    expect(isoDay(new Date(2026, 2, 5, 23, 30))).toBe('2026-03-05')
})

test('dayDifference counts calendar days', () => {
    expect(dayDifference(new Date(2026, 2, 1), new Date(2026, 2, 5))).toBe(4)
    expect(dayDifference(new Date(2026, 2, 5), new Date(2026, 2, 1))).toBe(-4)
    expect(
        dayDifference(new Date(2026, 2, 5, 9), new Date(2026, 2, 5, 23))
    ).toBe(0)
})

test('dayDifference across a daylight-saving change', () => {
    expect(dayDifference(new Date(2026, 2, 28), new Date(2026, 2, 30))).toBe(2)
})

test('dayDifference with a missing date', () => {
    expect(dayDifference(undefined, new Date(2026, 2, 5))).toBeUndefined()
    expect(dayDifference(new Date(2026, 2, 5), undefined)).toBeUndefined()
})
