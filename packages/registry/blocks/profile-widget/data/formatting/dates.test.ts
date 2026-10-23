import { SystemInfoSchema, type ProfileSystemInfo } from '../../api/schemas'
import { formatServerDate, formatServerDateTime } from './dates'

const systemInfo = (
    calendar: ProfileSystemInfo['calendar'],
    dateFormat: ProfileSystemInfo['dateFormat'] = 'YYYY-MM-DD'
): ProfileSystemInfo => ({ calendar, dateFormat })

describe('formatServerDate', () => {
    it('keeps ISO dates in YYYY-MM-DD for the iso8601 and gregorian calendars', () => {
        expect(formatServerDate('2024-03-01', systemInfo('iso8601'))).toBe(
            '2024-03-01'
        )
        expect(formatServerDate('2024-03-01', systemInfo('gregorian'))).toBe(
            '2024-03-01'
        )
    })

    it('honours the DD-MM-YYYY system date format', () => {
        expect(
            formatServerDate('2024-03-01', systemInfo('iso8601', 'DD-MM-YYYY'))
        ).toBe('01-03-2024')
    })

    it('reads the date part of a server date-time', () => {
        expect(
            formatServerDate('2024-03-01T23:59:00.000', systemInfo('iso8601'))
        ).toBe('2024-03-01')
    })

    it.each([
        ['ethiopian', '2016-06-22'],
        ['coptic', '1740-06-22'],
        ['thai', '2567-03-01'],
        ['persian', '1402-12-11'],
        ['nepali', '2080-11-18'],
    ] as const)('converts to the %s calendar', (calendar, expected) => {
        expect(formatServerDate('2024-03-01', systemInfo(calendar))).toBe(
            expected
        )
    })

    it('formats Ethiopian dates in DD-MM-YYYY, including the 13th month', () => {
        expect(
            formatServerDate(
                '2024-03-01',
                systemInfo('ethiopian', 'DD-MM-YYYY')
            )
        ).toBe('22-06-2016')
        // Pagume 1, 2015 (Ethiopian) is 6 September 2023.
        expect(formatServerDate('2023-09-06', systemInfo('ethiopian'))).toBe(
            '2015-13-01'
        )
    })

    it.each(['', 'not a date', '2024-02-30', '01-03-2024'])(
        'returns undefined for %j',
        (value) => {
            expect(formatServerDate(value, systemInfo('iso8601'))).toBe(
                undefined
            )
        }
    )

    it('works with the normalised system/info response', () => {
        const info = SystemInfoSchema.parse({
            calendar: 'iso8601',
            dateFormat: 'dd-mm-yyyy',
        })
        expect(formatServerDate('2024-03-01', info)).toBe('01-03-2024')
    })
})

describe('formatServerDateTime', () => {
    it('appends the lexical HH:mm of a zone-less server value', () => {
        expect(
            formatServerDateTime(
                '2024-03-01T07:05:00.000',
                systemInfo('iso8601')
            )
        ).toBe('2024-03-01 07:05')
        expect(
            formatServerDateTime('2024-03-01 18:30', systemInfo('iso8601'))
        ).toBe('2024-03-01 18:30')
    })

    it('shows midnight when the value has no time', () => {
        expect(formatServerDateTime('2024-03-01', systemInfo('iso8601'))).toBe(
            '2024-03-01 00:00'
        )
    })

    it('converts a value with an explicit zone to the browser zone', () => {
        const value = '2024-03-01T12:34:00.000Z'
        const local = new Date(value)
        const pad = (part: number) => part.toString().padStart(2, '0')
        expect(formatServerDateTime(value, systemInfo('iso8601'))).toBe(
            `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())} ${pad(local.getHours())}:${pad(local.getMinutes())}`
        )
    })

    it('uses the system calendar for the date part', () => {
        expect(
            formatServerDateTime(
                '2024-03-01T10:15:00',
                systemInfo('ethiopian', 'DD-MM-YYYY')
            )
        ).toBe('22-06-2016 10:15')
    })

    it('returns undefined for values that are not dates', () => {
        expect(formatServerDateTime('10:15', systemInfo('iso8601'))).toBe(
            undefined
        )
    })
})
