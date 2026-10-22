import { WorkingListSystemInfoSchema } from '../api/systemInfo'
import {
    createWorkingListValueTransformers,
    isValidWorkingListClientDate,
    toMultiCalendarIdentifier,
} from './transformers'

describe('Capture-style working-list value transformers', () => {
    it.each([
        ['gregorian', 'gregory'],
        ['ethiopian', 'ethiopic'],
        ['thai', 'buddhist'],
        ['coptic', 'coptic'],
        ['islamic', 'islamic'],
        ['iso8601', 'iso8601'],
        ['nepali', 'nepali'],
        ['persian', 'persian'],
    ] as const)(
        'maps DHIS2 %s to the multi-calendar identifier %s',
        (input, output) => {
            expect(toMultiCalendarIdentifier(input)).toBe(output)
        }
    )

    it.each([
        ['yyyy-mm-dd', 'YYYY-MM-DD'],
        ['yyyy-MM-dd', 'YYYY-MM-DD'],
        ['dd-mm-yyyy', 'DD-MM-YYYY'],
        ['dd-MM-yyyy', 'DD-MM-YYYY'],
    ] as const)('normalizes server date format %s', (input, output) => {
        expect(
            WorkingListSystemInfoSchema.parse({
                calendar: 'gregorian',
                dateFormat: input,
                serverTimeZoneId: 'Europe/Oslo',
                futureServerField: true,
            }).dateFormat
        ).toBe(output)
    })

    it('fails malformed system-info fields at the boundary', () => {
        expect(() =>
            WorkingListSystemInfoSchema.parse({
                calendar: 'unknown',
                dateFormat: 'MM/DD/YYYY',
                serverTimeZoneId: 'not/a-zone',
            })
        ).toThrow()
    })

    it('separates editor, API and locale-aware view date formats', () => {
        const transformers = createWorkingListValueTransformers({
            systemInfo: {
                calendar: 'gregorian',
                dateFormat: 'DD-MM-YYYY',
                serverTimeZoneId: 'Europe/Oslo',
            },
            locale: 'en-GB',
            today: '2026-08-18',
        })

        expect(transformers.serverToClient('2026-08-18', 'DATE')).toBe(
            '2026-08-18'
        )
        expect(transformers.serverToView('2026-08-18', 'DATE')).toBe(
            '18/08/2026'
        )
        expect(transformers.clientToServer('2026-08-18', 'DATE')).toBe(
            '2026-08-18'
        )
        expect(
            transformers.serverToView('2026-08-18T14:30:00.000Z', 'DATETIME')
        ).toBe('18/08/2026, 14:30:00')
    })

    it('uses the injected locale without shifting lexical Tracker dates', () => {
        const transformers = createWorkingListValueTransformers({
            systemInfo: {
                calendar: 'gregorian',
                dateFormat: 'YYYY-MM-DD',
                serverTimeZoneId: 'Pacific/Kiritimati',
            },
            locale: 'en-US',
            today: '2026-08-18',
        })

        expect(transformers.serverToView('2026-08-18', 'DATE')).toBe(
            '08/18/2026'
        )
        expect(
            transformers.serverToView(
                '2026-08-18T23:30:00.000-11:00',
                'DATETIME'
            )
        ).toBe('08/18/2026, 11:30:00 PM')
    })

    it.each([
        ['ethiopian', 'ethiopic'],
        ['coptic', 'coptic'],
        ['islamic', 'islamic'],
        ['persian', 'persian'],
        ['thai', 'buddhist'],
    ] as const)(
        'formats the DHIS2 %s calendar with Intl %s',
        (calendar, intlCalendar) => {
            const transformers = createWorkingListValueTransformers({
                systemInfo: {
                    calendar,
                    dateFormat: 'DD-MM-YYYY',
                    serverTimeZoneId: 'UTC',
                },
                locale: 'en-GB',
                today: '2024-05-23',
            })
            const expected = new Intl.DateTimeFormat('en-GB', {
                calendar: intlCalendar,
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                timeZone: 'UTC',
            }).format(new Date(Date.UTC(2024, 4, 23, 12)))

            expect(transformers.serverToView('2024-05-23', 'DATE')).toBe(
                expected
            )
        }
    )

    it('uses the locale while preserving non-Gregorian lexical date-time fields', () => {
        const createTransformers = (locale: string) =>
            createWorkingListValueTransformers({
                systemInfo: {
                    calendar: 'ethiopian',
                    dateFormat: 'YYYY-MM-DD',
                    serverTimeZoneId: 'Pacific/Kiritimati',
                },
                locale,
                today: '2024-05-23',
            })
        const lexicalDate = new Date(Date.UTC(2024, 4, 23, 23, 30))
        const expected = (locale: string) =>
            new Intl.DateTimeFormat(locale, {
                calendar: 'ethiopic',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                second: '2-digit',
                timeZone: 'UTC',
            }).format(lexicalDate)

        const enUs = createTransformers('en-US').serverToView(
            '2024-05-23T23:30:00.000-11:00',
            'DATETIME'
        )
        const enGb = createTransformers('en-GB').serverToView(
            '2024-05-23T23:30:00.000-11:00',
            'DATETIME'
        )

        expect(enUs).toBe(expected('en-US'))
        expect(enGb).toBe(expected('en-GB'))
        expect(enUs).not.toBe(enGb)
    })

    it('retains the validated DHIS2 view fallback for the Nepali calendar', () => {
        const transformers = createWorkingListValueTransformers({
            systemInfo: {
                calendar: 'nepali',
                dateFormat: 'DD-MM-YYYY',
                serverTimeZoneId: 'Asia/Kathmandu',
            },
            locale: 'ne-NP',
            today: '2024-05-23',
        })

        expect(transformers.serverToView('2024-05-23', 'DATE')).toBe(
            '10-02-2081'
        )
    })

    it('resolves server-calendar relative periods deterministically', () => {
        const transformers = createWorkingListValueTransformers({
            systemInfo: {
                calendar: 'gregorian',
                dateFormat: 'YYYY-MM-DD',
                serverTimeZoneId: 'Europe/Oslo',
            },
            today: '2026-08-18',
            firstDayOfWeek: 1,
        })

        expect(transformers.resolveRelativeDate({ period: 'TODAY' })).toEqual({
            start: '2026-08-18',
            end: '2026-08-18',
        })
        expect(
            transformers.resolveRelativeDate({
                startBuffer: -7,
                endBuffer: 0,
            })
        ).toEqual({ start: '2026-08-11', end: '2026-08-18' })
    })

    it('rejects Julian at the system-info boundary', () => {
        expect(() =>
            WorkingListSystemInfoSchema.parse({
                calendar: 'julian',
                dateFormat: 'YYYY-MM-DD',
                serverTimeZoneId: 'UTC',
            })
        ).toThrow()
    })

    it.each([
        ['gregorian', '2024-02-29', '2025-02-29'],
        ['iso8601', '2024-02-29', '2025-02-29'],
        ['ethiopian', '2015-13-06', '2016-13-06'],
        ['coptic', '1739-13-06', '1740-13-06'],
        ['islamic', '1448-03-30', '1448-03-31'],
        ['nepali', '2083-05-31', '2083-05-32'],
        ['persian', '1405-05-31', '1405-05-32'],
        ['thai', '2569-02-28', '2569-02-29'],
    ] as const)(
        'validates semantic %s calendar dates',
        (calendar, valid, invalid) => {
            expect(isValidWorkingListClientDate(valid, { calendar })).toBe(true)
            expect(isValidWorkingListClientDate(invalid, { calendar })).toBe(
                false
            )
        }
    )

    it('rejects overflowing dates instead of allowing converter clamping', () => {
        const transformers = createWorkingListValueTransformers({
            systemInfo: {
                calendar: 'gregorian',
                dateFormat: 'YYYY-MM-DD',
                serverTimeZoneId: 'UTC',
            },
            today: '2026-08-18',
        })

        expect(() => transformers.clientToServer('2025-02-31', 'DATE')).toThrow(
            'Invalid gregorian calendar date'
        )
        expect(() =>
            transformers.serializationContext.validateDate?.('2025-13-01')
        ).toThrow('Invalid gregorian calendar date')
        expect(() => transformers.serverToClient('2025-02-31', 'DATE')).toThrow(
            'Invalid server date'
        )
    })

    it.each([
        ['ethiopian', '2016-09-15'],
        ['coptic', '1740-09-15'],
    ] as const)(
        'round-trips valid %s dates without relying on converter overflow',
        (calendar, clientDate) => {
            const transformers = createWorkingListValueTransformers({
                systemInfo: {
                    calendar,
                    dateFormat: 'YYYY-MM-DD',
                    serverTimeZoneId: 'UTC',
                },
                today: '2024-05-23',
            })

            expect(transformers.clientToServer(clientDate, 'DATE')).toBe(
                '2024-05-23'
            )
            expect(transformers.serverToClient('2024-05-23', 'DATE')).toBe(
                clientDate
            )
            const month = transformers.resolveRelativeDate({
                period: 'THIS_MONTH',
            })
            expect(transformers.serverToClient(month.start!, 'DATE')).toMatch(
                /-09-01$/
            )
            expect(transformers.serverToClient(month.end!, 'DATE')).toMatch(
                /-09-30$/
            )
        }
    )

    it('rejects a semantically invalid deterministic today override', () => {
        expect(() =>
            createWorkingListValueTransformers({
                systemInfo: {
                    calendar: 'gregorian',
                    dateFormat: 'YYYY-MM-DD',
                    serverTimeZoneId: 'UTC',
                },
                today: '2025-02-29',
            })
        ).toThrow('Invalid today override')
    })
})
