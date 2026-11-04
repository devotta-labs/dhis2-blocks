import { describe, expect, it } from 'vitest'
import type { FinderSystemInfo } from '../api/systemInfo'
import { calendarDateToIso, isoToCalendarDate } from './calendarDates'

const gregorian: FinderSystemInfo = {
    calendar: 'gregorian',
    dateFormat: 'YYYY-MM-DD',
}
const gregorianDayFirst: FinderSystemInfo = {
    calendar: 'gregorian',
    dateFormat: 'DD-MM-YYYY',
}
const ethiopian: FinderSystemInfo = {
    calendar: 'ethiopian',
    dateFormat: 'YYYY-MM-DD',
}

describe('calendar dates', () => {
    // Reference pairs from working-list's calendar tests, plus v1's Ethiopian
    // new-year pairs (Meskerem 1, 2017 and Pagume 1, 2016).
    it.each([
        ['gregorian', 'YYYY-MM-DD', '2024-05-23', '2024-05-23'],
        ['iso8601', 'YYYY-MM-DD', '2024-05-23', '2024-05-23'],
        ['gregorian', 'DD-MM-YYYY', '23-05-2024', '2024-05-23'],
        ['nepali', 'DD-MM-YYYY', '10-02-2081', '2024-05-23'],
        ['nepali', 'YYYY-MM-DD', '2081-02-10', '2024-05-23'],
        ['ethiopian', 'YYYY-MM-DD', '2016-09-15', '2024-05-23'],
        ['ethiopian', 'YYYY-MM-DD', '2017-01-01', '2024-09-11'],
        ['ethiopian', 'DD-MM-YYYY', '01-13-2016', '2024-09-06'],
        ['coptic', 'YYYY-MM-DD', '1740-09-15', '2024-05-23'],
    ] as const)(
        'round-trips %s %s %s and ISO %s',
        (calendar, dateFormat, local, iso) => {
            const info: FinderSystemInfo = { calendar, dateFormat }
            expect(calendarDateToIso(local, info)).toBe(iso)
            expect(isoToCalendarDate(iso, info)).toBe(local)
        }
    )

    it('ignores surrounding spaces in a typed date', () => {
        expect(calendarDateToIso(' 2024-05-23 ', gregorian)).toBe('2024-05-23')
    })

    it.each([
        ['an empty value', '', gregorian],
        ['text', 'yesterday', gregorian],
        ['a day that does not exist', '2025-02-31', gregorian],
        ['the wrong format', '2024-05-23', gregorianDayFirst],
        ['a partial date', '2024-05', gregorian],
        ['a 31st day in a 30-day Ethiopian month', '2017-01-31', ethiopian],
        ['Pagume 6 outside a leap year', '2016-13-06', ethiopian],
        ['a 14th Ethiopian month', '2016-14-01', ethiopian],
        [
            'a Nepali day past the month end',
            '2083-05-32',
            {
                calendar: 'nepali',
                dateFormat: 'YYYY-MM-DD',
            } satisfies FinderSystemInfo,
        ],
    ])('rejects %s', (_, value, info) => {
        expect(calendarDateToIso(value, info)).toBeUndefined()
    })

    it('accepts Pagume 6 in an Ethiopian leap year', () => {
        expect(calendarDateToIso('2015-13-06', ethiopian)).toBe('2023-09-11')
    })

    it.each([
        ['text', 'not a date'],
        ['a day that does not exist', '2025-02-31'],
        ['a partial date', '2024-05'],
    ])('shows %s unchanged', (_, value) => {
        expect(isoToCalendarDate(value, ethiopian)).toBe(value)
    })
})
