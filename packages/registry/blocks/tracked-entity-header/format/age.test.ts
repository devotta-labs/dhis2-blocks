import { describe, expect, it } from 'vitest'
import { ageOf, formatAge, todayIso } from './age'

describe('ageOf', () => {
    it('counts days under one month', () => {
        expect(ageOf('2026-11-01', '2026-11-11', 'gregorian')).toEqual({
            unit: 'days',
            count: 10,
        })
        expect(ageOf('2026-11-11', '2026-11-11', 'gregorian')).toEqual({
            unit: 'days',
            count: 0,
        })
    })

    it('counts months under two years, turning on the calendar day', () => {
        expect(ageOf('2026-10-11', '2026-11-11', 'gregorian')).toEqual({
            unit: 'months',
            count: 1,
        })
        expect(ageOf('2026-10-12', '2026-11-11', 'gregorian')).toEqual({
            unit: 'days',
            count: 30,
        })
        expect(ageOf('2024-11-12', '2026-11-11', 'gregorian')).toEqual({
            unit: 'months',
            count: 23,
        })
    })

    it('counts years from two', () => {
        expect(ageOf('2024-11-11', '2026-11-11', 'gregorian')).toEqual({
            unit: 'years',
            count: 2,
        })
        expect(ageOf('1990-11-12', '2026-11-11', 'gregorian')).toEqual({
            unit: 'years',
            count: 35,
        })
        expect(
            ageOf('1990-11-11T00:00:00.000', '2026-11-11', 'iso8601')
        ).toEqual({ unit: 'years', count: 36 })
    })

    it('clamps a month-end birth to a shorter month, as the library adds', () => {
        expect(ageOf('2026-01-31', '2026-02-28', 'gregorian')).toEqual({
            unit: 'months',
            count: 1,
        })
    })

    it('counts in the Ethiopian calendar, which has a 13th month', () => {
        // 2016-05-22 Ethiopian; one Ethiopian month later is 2024-03-01 ISO.
        expect(ageOf('2024-01-31', '2024-02-29', 'ethiopian')).toEqual({
            unit: 'days',
            count: 29,
        })
        expect(ageOf('2024-01-31', '2024-03-01', 'ethiopian')).toEqual({
            unit: 'months',
            count: 1,
        })
        // 13 months make a year, so 26 Ethiopian months are two years.
        expect(ageOf('2024-01-31', '2026-01-31', 'ethiopian')).toEqual({
            unit: 'years',
            count: 2,
        })
    })

    it('counts in the Nepali calendar, whose month lengths vary', () => {
        // 2024-01-15 is 2080-10-01 Nepali, and month 10 of 2080 has 29 days.
        expect(ageOf('2024-01-15', '2024-02-12', 'nepali')).toEqual({
            unit: 'days',
            count: 28,
        })
        expect(ageOf('2024-01-15', '2024-02-13', 'nepali')).toEqual({
            unit: 'months',
            count: 1,
        })
        expect(ageOf('2024-01-15', '2024-02-13', 'gregorian')).toEqual({
            unit: 'days',
            count: 29,
        })
    })

    it('shows no age for a future, unreadable or unconvertible date', () => {
        expect(ageOf('2026-11-12', '2026-11-11', 'gregorian')).toBeUndefined()
        expect(ageOf('not a date', '2026-11-11', 'gregorian')).toBeUndefined()
        expect(ageOf('2020-01-01', '2026-11-11', 'coptic')).toBeUndefined()
    })
})

describe('formatAge', () => {
    it('names the unit, singular for one', () => {
        expect(formatAge({ unit: 'years', count: 35 })).toBe('35 years')
        expect(formatAge({ unit: 'months', count: 1 })).toBe('1 month')
        expect(formatAge({ unit: 'days', count: 12 })).toBe('12 days')
    })
})

describe('todayIso', () => {
    it('is the local day', () => {
        expect(todayIso(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
    })
})
