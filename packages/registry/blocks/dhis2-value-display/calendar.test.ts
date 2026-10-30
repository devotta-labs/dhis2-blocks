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
    it.each(['th', 'fa', 'prs', 'ps'])(
        'stays Gregorian in the %s locale, whose own calendar differs',
        (locale) =>
            expect(formatCalendarDate('2024-03-01', 'gregorian', locale)).toBe(
                new Intl.DateTimeFormat(`${locale}-u-ca-gregory`, {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    timeZone: 'UTC',
                }).format(new Date('2024-03-01T00:00:00Z'))
            )
    )
    it.each([
        ['2026-10-14', 'ethiopian', '2019-02-04'],
        ['2026-10-18', 'nepali', '2083-07-01'],
        // The calendar library cannot convert Coptic, so the ISO day shows.
        ['2026-10-14', 'coptic', '2026-10-14'],
    ] as const)(
        'formats %s in the %s calendar as %s',
        (day, calendar, expected) =>
            expect(formatCalendarDate(day, calendar, 'en')).toBe(expected)
    )
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
