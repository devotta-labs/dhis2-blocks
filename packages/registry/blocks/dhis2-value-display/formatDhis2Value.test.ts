import { formatDhis2Value } from './formatDhis2Value'

const opts = { calendar: 'gregorian', locale: 'en' } as const
const optionSet = {
    options: [
        { code: 'POS', displayName: 'Positive' },
        { code: 'A', displayName: 'Alpha' },
        { code: 'B', displayName: 'Beta' },
    ],
}

describe('formatDhis2Value', () => {
    it.each([
        ['TEXT', 'hello', 'hello'],
        ['LONG_TEXT', 'a\nb', 'a\nb'],
        ['INTEGER', '1200', '1,200'],
        ['NUMBER', '3.5', '3.5'],
        ['PERCENTAGE', '40', '40%'],
        ['BOOLEAN', 'true', 'Yes'],
        ['BOOLEAN', 'false', 'No'],
        ['TRUE_ONLY', 'true', 'Yes'],
        ['DATE', '2026-10-14', 'Oct 14, 2026'],
        ['AGE', '1990-01-02', 'Jan 2, 1990'],
        ['DATETIME', '2026-10-14T23:30:00.000', 'Oct 14, 2026 23:30'],
        ['TIME', '08:05', '08:05'],
        ['COORDINATE', '[13.2,8.4]', '8.4, 13.2'],
    ])('formats %s', (valueType, value, expected) =>
        expect(formatDhis2Value(value, { valueType }, opts)).toBe(expected)
    )

    it('keeps every stored decimal', () => {
        expect(formatDhis2Value('3.14159', { valueType: 'NUMBER' }, opts)).toBe(
            '3.14159'
        )
        expect(
            formatDhis2Value('12.345678', { valueType: 'PERCENTAGE' }, opts)
        ).toBe('12.345678%')
    })
    it('maps an option code to its name', () =>
        expect(
            formatDhis2Value('POS', { valueType: 'TEXT', optionSet }, opts)
        ).toBe('Positive'))
    it('maps each MULTI_TEXT code and joins with ", "', () =>
        expect(
            formatDhis2Value(
                'A,B',
                { valueType: 'MULTI_TEXT', optionSet },
                opts
            )
        ).toBe('Alpha, Beta'))
    it('returns the raw code when the option is missing', () =>
        expect(
            formatDhis2Value('GONE', { valueType: 'TEXT', optionSet }, opts)
        ).toBe('GONE'))
    it('names an org unit from orgUnitNames, else shows the id', () => {
        const orgUnitNames = new Map([['ou1', 'Bo District']])
        const withNames = { ...opts, orgUnitNames }
        expect(
            formatDhis2Value(
                'ou1',
                { valueType: 'ORGANISATION_UNIT' },
                withNames
            )
        ).toBe('Bo District')
        expect(
            formatDhis2Value(
                'ou2',
                { valueType: 'ORGANISATION_UNIT' },
                withNames
            )
        ).toBe('ou2')
    })
    it('returns the raw string for an unknown value type', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        expect(
            formatDhis2Value('{"a":1}', { valueType: 'GEOJSON' }, opts)
        ).toBe('{"a":1}')
        formatDhis2Value('{"a":2}', { valueType: 'GEOJSON' }, opts)
        expect(warn).toHaveBeenCalledTimes(1)
        warn.mockRestore()
    })
    it('returns an empty string for null, undefined and ""', () => {
        for (const value of [null, undefined, '']) {
            expect(formatDhis2Value(value, { valueType: 'TEXT' }, opts)).toBe(
                ''
            )
        }
    })
})
