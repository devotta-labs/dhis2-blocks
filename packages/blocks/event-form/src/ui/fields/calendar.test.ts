import type { SystemCalendar } from '../../api/schemas'
import {
    ageBetween,
    calendarDateToIso,
    calendarInputDateToCanonical,
    canonicalDateToCalendarInput,
    isoToCalendarDate,
} from './calendar'

const CALENDARS: SystemCalendar['calendar'][] = [
    'coptic',
    'ethiopian',
    'gregorian',
    'islamic',
    'iso8601',
    'nepali',
    'persian',
    'thai',
]

describe('calendar input formats', () => {
    it.each([
        ['2026-08-18', 'YYYY-MM-DD', '2026-08-18'],
        ['2026-08-18', 'DD-MM-YYYY', '18-08-2026'],
        ['2026-02-31', 'DD-MM-YYYY', '31-02-2026'],
        [undefined, 'DD-MM-YYYY', undefined],
    ] as const)(
        'adapts canonical %s to %s as %s',
        (canonical, format, expected) => {
            expect(canonicalDateToCalendarInput(canonical, format)).toBe(
                expected
            )
            expect(calendarInputDateToCanonical(expected, format)).toBe(
                canonical
            )
        }
    )
})

describe('system calendar conversion', () => {
    it('shows 2026-03-13 as 2018-07-04 in the Ethiopian calendar', () => {
        expect(isoToCalendarDate('2026-03-13', 'ethiopian')).toBe('2018-07-04')
        expect(calendarDateToIso('2018-07-04', 'ethiopian')).toBe('2026-03-13')
    })

    it.each(CALENDARS)('round-trips ISO dates through %s', (calendar) => {
        for (const iso of ['2026-03-13', '2024-02-29', '2025-12-31']) {
            const local = isoToCalendarDate(iso, calendar)
            expect(local).toMatch(/^\d{4}-\d{2}-\d{2}$/)
            expect(calendarDateToIso(local ?? '', calendar)).toBe(iso)
        }
    })

    it('leaves Gregorian and ISO 8601 dates as they are', () => {
        expect(isoToCalendarDate('2026-03-13', 'gregorian')).toBe('2026-03-13')
        expect(calendarDateToIso('2026-03-13', 'iso8601')).toBe('2026-03-13')
    })

    it('rejects dates that do not exist in the calendar', () => {
        expect(calendarDateToIso('2026-02-31', 'gregorian')).toBeUndefined()
        expect(calendarDateToIso('2018-02-31', 'ethiopian')).toBeUndefined()
        // 2018 is not an Ethiopian leap year, so Pagume has 5 days.
        expect(calendarDateToIso('2018-13-06', 'ethiopian')).toBeUndefined()
        expect(calendarDateToIso('2018-13-05', 'ethiopian')).toBe('2026-09-10')
        expect(calendarDateToIso('not a date', 'ethiopian')).toBeUndefined()
        expect(isoToCalendarDate('2026-02-31', 'ethiopian')).toBeUndefined()
    })
})

describe('ageBetween', () => {
    it('counts whole years, months and days', () => {
        expect(ageBetween('2020-02-29', '2026-03-12')).toEqual({
            years: 6,
            months: 0,
            days: 12,
        })
        expect(ageBetween('2025-12-31', '2026-03-01')).toEqual({
            years: 0,
            months: 2,
            days: 1,
        })
        expect(ageBetween('2026-03-12', '2026-03-12')).toEqual({
            years: 0,
            months: 0,
            days: 0,
        })
    })

    it('has no age for a future date or an invalid one', () => {
        expect(ageBetween('2026-03-13', '2026-03-12')).toBeUndefined()
        expect(ageBetween('2026-02-31', '2026-03-12')).toBeUndefined()
    })
})
