import {
    formatCalendarDate,
    isoFromCoptic,
    isoFromEthiopian,
    parseDhis2Calendar,
    storedDay,
    storedTime,
    toMultiCalendarIdentifier,
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
    it('formats an Ethiopian day as YYYY-MM-DD in that calendar', () =>
        expect(formatCalendarDate('2026-10-14', 'ethiopian', 'en')).toBe(
            '2019-02-04'
        ))
    it.each([
        ['2026-10-14', 'ethiopian', '2019-02-04'],
        ['2026-10-14', 'coptic', '1743-02-04'],
        // 1 Meskerem: 11 September, or 12 in the year before a leap year.
        ['2026-09-11', 'ethiopian', '2019-01-01'],
        ['2027-09-11', 'ethiopian', '2019-13-06'],
        ['2027-09-12', 'ethiopian', '2020-01-01'],
        ['2024-01-01', 'ethiopian', '2016-04-22'],
        // 1 Pagume 2018 E.C.
        ['2026-09-06', 'ethiopian', '2018-13-01'],
    ] as const)(
        'formats %s in the %s calendar as %s, whatever the ICU version',
        (day, calendar, expected) =>
            expect(formatCalendarDate(day, calendar, 'en')).toBe(expected)
    )
    it('reads an Ethiopian day back as the ISO day the formatter shows it for', () => {
        expect(isoFromEthiopian({ year: 2019, month: 2, day: 4 })).toBe(
            '2026-10-14'
        )
        for (const iso of [
            '2026-09-11',
            '2027-09-11',
            '2027-09-12',
            '2024-01-01',
        ]) {
            const [year, month, day] = formatCalendarDate(iso, 'ethiopian')
                .split('-')
                .map(Number)
            expect(isoFromEthiopian({ year, month, day })).toBe(iso)
        }
    })
    it('reads a Coptic day back as the ISO day the formatter shows it for', () => {
        for (const iso of ['2026-09-11', '2027-09-12', '2024-01-01']) {
            const [year, month, day] = formatCalendarDate(iso, 'coptic')
                .split('-')
                .map(Number)
            expect(isoFromCoptic({ year, month, day })).toBe(iso)
        }
    })
    it.each([
        ['ethiopian', 'ethiopic'],
        ['gregorian', 'gregory'],
        ['thai', 'buddhist'],
        ['nepali', 'nepali'],
    ] as const)('names %s as %s for the calendar library', (calendar, id) =>
        expect(toMultiCalendarIdentifier(calendar)).toBe(id)
    )
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
