import {
    formatCalendarDate,
    parseDhis2Calendar,
    storedDay,
    storedTime,
} from './calendar'

describe('calendar', () => {
    it('formats a Gregorian day as a short locale date', () =>
        expect(formatCalendarDate('2026-10-14', 'gregorian', 'en')).toBe(
            'Oct 14, 2026'
        ))
    it('formats an Ethiopian day as YYYY-MM-DD in that calendar', () =>
        expect(formatCalendarDate('2026-10-14', 'ethiopian', 'en')).toBe(
            '2019-02-04'
        ))
    it('formats a Nepali day as YYYY-MM-DD in that calendar', () =>
        expect(formatCalendarDate('2026-10-14', 'nepali', 'en')).toMatch(
            /^2083-06-\d{2}$/
        ))
    it('keeps the stored day of a late-evening date-time', () =>
        expect(storedDay('2026-10-14T23:30:00.000')).toBe('2026-10-14'))
    it('reads no day from garbage', () =>
        expect(storedDay('yesterday')).toBeUndefined())
    it('reads the stored time of a date-time', () =>
        expect(storedTime('2026-10-14T23:30:00.000')).toBe('23:30'))
    it('reads no time from a bare date', () =>
        expect(storedTime('2026-10-14')).toBeUndefined())
    it('falls back to gregorian for an unknown calendar', () =>
        expect(parseDhis2Calendar('julian')).toBe('gregorian'))
    it('keeps a known calendar', () =>
        expect(parseDhis2Calendar('nepali')).toBe('nepali'))
})
