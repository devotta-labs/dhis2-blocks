import i18n from '@dhis2/d2-i18n'
import {
    checkStored,
    cellKind,
    coordinateNumber,
    inputModeFor,
    parseTyped,
    typedText,
} from './valueTypes'
import type { Field } from './types'

const GREGORIAN = { calendar: 'iso8601', dateFormat: 'YYYY-MM-DD' } as const

test.each([
    ['INTEGER', '-3', '-3'],
    ['INTEGER_POSITIVE', '4', '4'],
    ['NUMBER', '2.50', '2.50'],
    ['PERCENTAGE', '100', '100'],
    ['UNIT_INTERVAL', '0.5', '0.5'],
    ['LETTER', 'a', 'a'],
    ['TIME', '09:30', '09:30'],
    ['DATE', '2026-10-20', '2026-10-20'],
])('%s accepts %s', (valueType, text, stored) => {
    expect(parseTyped({ valueType }, text, GREGORIAN)).toEqual({
        ok: true,
        value: stored,
    })
})

test.each([
    // Bracketed is the stored [lng,lat] order; without brackets a coordinate is read latitude first.
    ['[8.2, -11.4]', '[8.2,-11.4]'],
    ['-11.4, 8.2', '[8.2,-11.4]'],
    // Numbers are read as number cells read them.
    ['.5, 5.', '[5,0.5]'],
    ['[007, -0]', '[7,0]'],
    ['90, 180', '[180,90]'],
    ['-90, -180', '[-180,-90]'],
])('the coordinate %s is stored as %s', (text, stored) => {
    expect(parseTyped({ valueType: 'COORDINATE' }, text, GREGORIAN)).toEqual({
        ok: true,
        value: stored,
    })
})

test.each([
    // Never swapped to fit: a latitude past 90 is refused, not read as a longitude.
    '91, 10',
    '[10, 91]',
    '10, 181',
    '[181, 10]',
    '+8, 1',
    '1e1, 1',
    '8,1,2',
    '[1,2,3]',
    '8.2',
])('the coordinate %s is refused', (text) => {
    expect(
        parseTyped({ valueType: 'COORDINATE' }, text, GREGORIAN)
    ).toMatchObject({
        ok: false,
        problem: { message: 'Enter a valid coordinate' },
    })
})

test('a coordinate number is the number a number cell reads, within its limit', () => {
    expect(coordinateNumber('latitude', ' .5 ')).toBe('0.5')
    expect(coordinateNumber('latitude', '90')).toBe('90')
    expect(coordinateNumber('latitude', '-90.1')).toBeUndefined()
    expect(coordinateNumber('longitude', '180')).toBe('180')
    expect(coordinateNumber('longitude', '-180.5')).toBeUndefined()
    expect(coordinateNumber('longitude', '+1')).toBeUndefined()
    expect(coordinateNumber('longitude', '')).toBeUndefined()
})

test('an age is typed as a date of birth in the system calendar and date format, and stored as an ISO date', () => {
    const age = { valueType: 'AGE' }
    const dayFirst = {
        calendar: 'gregorian',
        dateFormat: 'DD-MM-YYYY',
    } as const
    const ethiopian = {
        calendar: 'ethiopian',
        dateFormat: 'DD-MM-YYYY',
    } as const
    expect(parseTyped(age, '29-02-2020', dayFirst)).toEqual({
        ok: true,
        value: '2020-02-29',
    })
    expect(parseTyped(age, '21-06-2012', ethiopian)).toEqual({
        ok: true,
        value: '2020-02-29',
    })
    // The format of the system, as for any date.
    expect(parseTyped(age, '2020-02-29', dayFirst)).toMatchObject({
        ok: false,
        problem: { message: 'Enter a valid date' },
    })
    expect(parseTyped(age, '30-02-2020', dayFirst)).toMatchObject({ ok: false })
    expect(typedText(age, '2020-02-29', ethiopian)).toBe('21-06-2012')
    expect(typedText(age, '2020-02-29', dayFirst)).toBe('29-02-2020')
    expect(typedText(age, '2020-02-29', GREGORIAN)).toBe('2020-02-29')
})

test('a coordinate is read as "lat, lng" or "[lng,lat]" and stored as [lng,lat]', () => {
    for (const text of [
        '8.2, -11.4',
        '8.2,-11.4',
        '[-11.4,8.2]',
        '[ -11.4 , 8.2 ]',
    ]) {
        expect(
            parseTyped({ valueType: 'COORDINATE' }, text, GREGORIAN)
        ).toEqual({ ok: true, value: '[-11.4,8.2]' })
    }
})

test.each([
    ['INTEGER', '1.5', 'Enter a whole number'],
    ['INTEGER', '1,5', 'Enter a whole number'],
    ['INTEGER_POSITIVE', '0', 'Enter a whole number greater than zero'],
    ['INTEGER_NEGATIVE', '0', 'Enter a whole number less than zero'],
    ['INTEGER_ZERO_OR_POSITIVE', '-1', 'Enter a whole number of zero or more'],
    ['NUMBER', 'abc', 'Enter a number'],
    ['NUMBER', '1,5', 'Use a full stop for decimals'],
    ['NUMBER', '1,234', 'Use a full stop for decimals'],
    ['NUMBER', '1,2,3', 'Enter a number'],
    ['PERCENTAGE', '101', 'Enter a percentage between 0 and 100'],
    ['PERCENTAGE', '0,5', 'Use a full stop for decimals'],
    ['UNIT_INTERVAL', '2', 'Enter a number between 0 and 1'],
    ['LETTER', 'ab', 'Enter a single letter'],
    ['EMAIL', 'a@b', 'Enter a valid email address'],
    ['PHONE_NUMBER', 'phone', 'Enter a valid phone number'],
    ['URL', 'nope', 'Enter a valid URL'],
    ['URL', 'javascript:alert(1)', 'Enter a valid URL'],
    ['DATE', '2026-02-30', 'Enter a valid date'],
    ['DATETIME', '2026-10-20', 'Enter a valid date and time'],
    ['DATETIME', '2026-10-20 24:00', 'Enter a valid date and time'],
    ['TIME', '24:00', 'Enter a valid time'],
    ['AGE', '20-10-2026', 'Enter a valid date'],
    ['COORDINATE', '[200, 10]', 'Enter a valid coordinate'],
    ['ORGANISATION_UNIT', 'name', 'Select a valid organisation unit'],
    ['BOOLEAN', 'maybe', 'Select Yes or No'],
    ['TRUE_ONLY', 'maybe', 'Only Yes can be selected'],
])('%s refuses %s', (valueType, text, message) => {
    expect(parseTyped({ valueType }, text, GREGORIAN)).toMatchObject({
        ok: false,
        problem: { message },
    })
})

test('blank is no value', () =>
    expect(parseTyped({ valueType: 'NUMBER' }, '  ', GREGORIAN)).toEqual({
        ok: true,
        value: undefined,
    }))

test('typed text is trimmed', () =>
    expect(parseTyped({ valueType: 'TEXT' }, '  hi ', GREGORIAN)).toEqual({
        ok: true,
        value: 'hi',
    }))

test.each([['yes'], ['Yes'], ['x'], ['1'], ['true']])(
    'Yes/No reads %s as true',
    (text) =>
        expect(parseTyped({ valueType: 'BOOLEAN' }, text, GREGORIAN)).toEqual({
            ok: true,
            value: 'true',
        })
)

test.each([['no'], ['No'], ['0'], ['false']])(
    'Yes/No reads %s as false, and a yes-only field clears',
    (text) => {
        expect(parseTyped({ valueType: 'BOOLEAN' }, text, GREGORIAN)).toEqual({
            ok: true,
            value: 'false',
        })
        expect(parseTyped({ valueType: 'TRUE_ONLY' }, text, GREGORIAN)).toEqual(
            { ok: true, value: undefined }
        )
    }
)

test('an option is found by code or name, ignoring case', () => {
    const field = {
        valueType: 'TEXT',
        options: [{ code: 'A00', name: 'A00 Cholera' }],
    }
    expect(parseTyped(field, 'a00', GREGORIAN)).toEqual({
        ok: true,
        value: 'A00',
    })
    expect(parseTyped(field, 'a00 cholera', GREGORIAN)).toEqual({
        ok: true,
        value: 'A00',
    })
    expect(parseTyped(field, 'B01', GREGORIAN)).toMatchObject({
        ok: false,
        problem: { message: 'Choose one of the options' },
    })
})

test('a code wins over another option with that name', () => {
    const field = {
        valueType: 'TEXT',
        options: [
            { code: 'B', name: 'A' },
            { code: 'A', name: 'Other' },
        ],
    }
    expect(parseTyped(field, 'a', GREGORIAN)).toEqual({
        ok: true,
        value: 'A',
    })
})

test('a multi-select reads each comma separated option', () => {
    const field = {
        valueType: 'MULTI_TEXT',
        options: [
            { code: 'A', name: 'Alpha' },
            { code: 'B', name: 'Beta' },
        ],
    }
    expect(parseTyped(field, 'alpha, B', GREGORIAN)).toEqual({
        ok: true,
        value: 'A,B',
    })
    expect(parseTyped(field, 'A, C', GREGORIAN)).toMatchObject({ ok: false })
    expect(parseTyped(field, 'Alpha, alpha, B, a', GREGORIAN)).toEqual({
        ok: true,
        value: 'A,B',
    })
})

test('a field mask must match the whole value', () => {
    expect(
        parseTyped(
            { valueType: 'TEXT', fieldMask: '\\d\\d-\\X' },
            '12-A',
            GREGORIAN
        )
    ).toEqual({ ok: true, value: '12-A' })
    expect(
        parseTyped(
            { valueType: 'TEXT', fieldMask: '\\d\\d-\\X' },
            '12-a',
            GREGORIAN
        )
    ).toMatchObject({
        ok: false,
        problem: { message: 'Enter a value in the required format' },
    })
    expect(
        parseTyped(
            { valueType: 'TEXT', fieldMask: '\\d\\d-\\X' },
            '12-AB',
            GREGORIAN
        )
    ).toMatchObject({ ok: false })
})

test('a mask in single quotes and an unparseable mask', () => {
    expect(
        parseTyped(
            { valueType: 'TEXT', fieldMask: "'\\w\\w'" },
            'a1',
            GREGORIAN
        )
    ).toMatchObject({ ok: true })
    expect(
        parseTyped({ valueType: 'TEXT', fieldMask: '(' }, 'anything', GREGORIAN)
    ).toMatchObject({ ok: true })
})

test.each([
    ['TEXT', 'text'],
    ['INTEGER', 'number'],
    ['DATE', 'date'],
    ['DATETIME', 'dateTime'],
    ['TIME', 'time'],
    ['BOOLEAN', 'boolean'],
    ['TRUE_ONLY', 'trueOnly'],
    ['LONG_TEXT', 'popup'],
    ['MULTI_TEXT', 'popup'],
    ['COORDINATE', 'popup'],
    ['ORGANISATION_UNIT', 'search'],
    ['USERNAME', 'search'],
    ['AGE', 'popup'],
    ['FILE_RESOURCE', 'popup'],
    ['GEOJSON', 'readOnly'],
    ['TRACKER_ASSOCIATE', 'readOnly'],
    ['REFERENCE', 'readOnly'],
    ['SOMETHING_NEW', 'readOnly'],
])('%s is a %s cell', (valueType, kind) =>
    expect(cellKind({ valueType })).toBe(kind)
)

test('a TEXT field with options is an option cell', () =>
    expect(cellKind({ valueType: 'TEXT', options: [] })).toBe('option'))

test('a multi-select with options stays a pop-up', () =>
    expect(cellKind({ valueType: 'MULTI_TEXT', options: [] })).toBe('popup'))

test.each([
    ['TEXT', 'text'],
    ['EMAIL', 'email'],
    ['PHONE_NUMBER', 'tel'],
    ['URL', 'url'],
    ['INTEGER_POSITIVE', 'numeric'],
    ['INTEGER_ZERO_OR_POSITIVE', 'numeric'],
    ['PERCENTAGE', 'decimal'],
    ['UNIT_INTERVAL', 'decimal'],
    // Phone keypads for numeric and decimal input have no minus key.
    ['INTEGER', undefined],
    ['INTEGER_NEGATIVE', undefined],
    ['NUMBER', undefined],
    ['DATE', undefined],
    ['BOOLEAN', undefined],
    ['LONG_TEXT', undefined],
])('%s has input mode %s', (valueType, mode) =>
    expect(inputModeFor({ valueType })).toBe(mode)
)

test('a field with options has no input mode', () =>
    expect(inputModeFor({ valueType: 'TEXT', options: [] })).toBeUndefined())

test('problems are made in the language set when they arise', async () => {
    i18n.addResources('xx', 'translation', {
        'Enter a whole number': 'Saisissez un nombre entier',
        'Enter a valid date': 'Saisissez une date valide',
    })
    await i18n.changeLanguage('xx')
    try {
        expect(parseTyped({ valueType: 'INTEGER' }, 'abc', GREGORIAN)).toEqual({
            ok: false,
            problem: { code: 'integer', message: 'Saisissez un nombre entier' },
        })
        expect(
            parseTyped({ valueType: 'DATE' }, '2026-13-40', GREGORIAN)
        ).toMatchObject({ problem: { message: 'Saisissez une date valide' } })
        expect(checkStored({ valueType: 'INTEGER' }, '12.5')?.message).toBe(
            'Saisissez un nombre entier'
        )
    } finally {
        await i18n.changeLanguage('en')
    }
})

test('legacy values are flagged', () => {
    expect(checkStored({ valueType: 'INTEGER' }, '12.5')?.message).toBe(
        'Enter a whole number'
    )
    expect(checkStored({ valueType: 'INTEGER' }, '12')).toBeUndefined()
    expect(
        checkStored(
            { valueType: 'TEXT', options: [{ code: 'A', name: 'Alpha' }] },
            'Alpha'
        )?.message
    ).toBe('Choose one of the options')
    expect(
        checkStored({ valueType: 'TEXT', fieldMask: '\\d\\d' }, 'ab')?.message
    ).toBe('Enter a value in the required format')
})

test('stored date times keep their time, whatever follows it', () => {
    expect(
        checkStored({ valueType: 'DATETIME' }, '2026-10-20T09:30:00.000')
    ).toBeUndefined()
})

test('a date time is typed as a date and a time', () => {
    const s = { calendar: 'iso8601', dateFormat: 'DD-MM-YYYY' } as const
    const field = { valueType: 'DATETIME' }
    expect(parseTyped(field, '20-10-2026 09:30', s)).toEqual({
        ok: true,
        value: '2026-10-20T09:30',
    })
    expect(typedText(field, '2026-10-20T09:30:00.000', s)).toBe(
        '20-10-2026 09:30'
    )
})

test.each([
    ['BOOLEAN', 'true', 'Yes'],
    ['BOOLEAN', 'false', 'No'],
    ['TRUE_ONLY', 'true', 'Yes'],
    ['NUMBER', '2.50', '2.50'],
    ['LONG_TEXT', 'a\nb', 'a\nb'],
])('%s %s is shown as %s', (valueType, value, shown) =>
    expect(typedText({ valueType }, value, GREGORIAN)).toBe(shown)
)

test('an option is shown by name, and by code when it has none', () => {
    const field = {
        valueType: 'TEXT',
        options: [{ code: 'A00', name: 'A00 Cholera' }],
    }
    expect(typedText(field, 'A00', GREGORIAN)).toBe('A00 Cholera')
    expect(typedText(field, 'Z99', GREGORIAN)).toBe('Z99')
})

test.each([[''], ['  ']])('a blank field mask %j is no mask', (fieldMask) =>
    expect(
        parseTyped({ valueType: 'TEXT', fieldMask }, 'anything', GREGORIAN)
    ).toEqual({ ok: true, value: 'anything' })
)

test('a field mask reads \\d, \\x, \\X and \\w inside a character class', () => {
    const field = { valueType: 'TEXT', fieldMask: '[\\dA-F]+' }
    expect(parseTyped(field, 'A3', GREGORIAN)).toEqual({
        ok: true,
        value: 'A3',
    })
    expect(parseTyped(field, 'G3', GREGORIAN)).toMatchObject({ ok: false })
    const negated = { valueType: 'TEXT', fieldMask: '[^\\d]+\\d' }
    expect(parseTyped(negated, 'ab1', GREGORIAN)).toMatchObject({ ok: true })
    expect(parseTyped(negated, '1b1', GREGORIAN)).toMatchObject({ ok: false })
    const words = { valueType: 'TEXT', fieldMask: '[\\x\\X]+-[\\w]+' }
    expect(parseTyped(words, 'aB-x9', GREGORIAN)).toMatchObject({ ok: true })
    expect(parseTyped(words, 'a1-x9', GREGORIAN)).toMatchObject({ ok: false })
})

test('an escaped bracket does not open a character class', () =>
    expect(
        parseTyped(
            { valueType: 'TEXT', fieldMask: '\\[\\d\\d' },
            '[12',
            GREGORIAN
        )
    ).toMatchObject({ ok: true }))

describe('an option is shown so that typing it gives the same option back', () => {
    const roundTrips = (field: Field) =>
        field.options?.map(({ code }) =>
            parseTyped(field, typedText(field, code, GREGORIAN), GREGORIAN)
        )

    test('options with the same name', () => {
        const field = {
            valueType: 'TEXT',
            options: [
                { code: '1', name: 'Other' },
                { code: '2', name: 'Other' },
                { code: '3', name: 'Third' },
            ],
        }
        expect(typedText(field, '1', GREGORIAN)).toBe('Other')
        expect(typedText(field, '2', GREGORIAN)).toBe('2')
        expect(typedText(field, '3', GREGORIAN)).toBe('Third')
        expect(roundTrips(field)).toEqual([
            { ok: true, value: '1' },
            { ok: true, value: '2' },
            { ok: true, value: '3' },
        ])
    })

    test('a name that is another option’s code', () => {
        const field = {
            valueType: 'TEXT',
            options: [
                { code: 'A', name: 'B' },
                { code: 'B', name: 'X' },
            ],
        }
        expect(typedText(field, 'A', GREGORIAN)).toBe('A')
        expect(typedText(field, 'B', GREGORIAN)).toBe('X')
        expect(roundTrips(field)).toEqual([
            { ok: true, value: 'A' },
            { ok: true, value: 'B' },
        ])
    })
})

test.each([
    ['INTEGER', '00012', '12'],
    ['INTEGER', '-0', '0'],
    ['INTEGER', '-007', '-7'],
    ['INTEGER', '5.', '5'],
    ['INTEGER', '2147483647', '2147483647'],
    ['INTEGER', '-2147483648', '-2147483648'],
    ['INTEGER_POSITIVE', '0012', '12'],
    ['INTEGER_ZERO_OR_POSITIVE', '000', '0'],
    ['INTEGER_NEGATIVE', '-00012', '-12'],
    ['NUMBER', '.5', '0.5'],
    ['NUMBER', '5.', '5'],
    ['NUMBER', '-0', '0'],
    ['NUMBER', '-0.0', '0.0'],
    ['NUMBER', '-.50', '-0.50'],
    ['NUMBER', '007.250', '7.250'],
    ['PERCENTAGE', '050', '50'],
    ['UNIT_INTERVAL', '.5', '0.5'],
])('%s %s is stored as %s', (valueType, text, stored) =>
    expect(parseTyped({ valueType }, text, GREGORIAN)).toEqual({
        ok: true,
        value: stored,
    })
)

test.each([
    ['NUMBER', '1e3', 'Enter a number'],
    ['NUMBER', '1E-3', 'Enter a number'],
    ['NUMBER', '-', 'Enter a number'],
    ['NUMBER', '.', 'Enter a number'],
    ['NUMBER', '+5', 'Enter a number'],
    ['PERCENTAGE', '1e1', 'Enter a percentage between 0 and 100'],
    ['UNIT_INTERVAL', '5e-1', 'Enter a number between 0 and 1'],
    ['INTEGER', '1e3', 'Enter a whole number'],
    ['INTEGER', '.5', 'Enter a whole number'],
    ['INTEGER', '5.0', 'Enter a whole number'],
])('%s refuses %s', (valueType, text, message) =>
    expect(parseTyped({ valueType }, text, GREGORIAN)).toMatchObject({
        ok: false,
        problem: { message },
    })
)

test.each([
    ['INTEGER', '007', 'Enter a whole number'],
    ['INTEGER', '-0', 'Enter a whole number'],
    ['INTEGER', '5.', 'Enter a whole number'],
    ['INTEGER', '1e3', 'Enter a whole number'],
    ['INTEGER_POSITIVE', '05', 'Enter a whole number greater than zero'],
    ['INTEGER_NEGATIVE', '-05', 'Enter a whole number less than zero'],
    ['INTEGER_ZERO_OR_POSITIVE', '00', 'Enter a whole number of zero or more'],
    ['NUMBER', '.5', 'Enter a number'],
    ['NUMBER', '5.', 'Enter a number'],
    ['NUMBER', '05', 'Enter a number'],
    ['NUMBER', '1e3', 'Enter a number'],
    ['PERCENTAGE', '.5', 'Enter a percentage between 0 and 100'],
    ['UNIT_INTERVAL', '.5', 'Enter a number between 0 and 1'],
])('a stored %s %s is flagged', (valueType, value, message) =>
    expect(checkStored({ valueType }, value)?.message).toBe(message)
)

test.each([
    ['INTEGER', '0'],
    ['INTEGER', '-12'],
    ['INTEGER_NEGATIVE', '-1'],
    ['NUMBER', '0'],
    ['NUMBER', '-0.5'],
    ['NUMBER', '2.50'],
    ['NUMBER', '-0'],
    ['PERCENTAGE', '99.5'],
    ['UNIT_INTERVAL', '0.25'],
])('a stored %s %s is fine', (valueType, value) =>
    expect(checkStored({ valueType }, value)).toBeUndefined()
)

test.each([
    ['(+232) 76 123456'],
    ['#123456'],
    ['+232-76/123.456'],
    ['1'.repeat(50)],
    ['555 123 ext 12'],
    ['123456'],
])('PHONE_NUMBER accepts %s', (text) =>
    expect(parseTyped({ valueType: 'PHONE_NUMBER' }, text, GREGORIAN)).toEqual({
        ok: true,
        value: text,
    })
)

test.each([['phone'], ['12a'], ['12345'], ['1'.repeat(51)]])(
    'PHONE_NUMBER refuses %s',
    (text) =>
        expect(
            parseTyped({ valueType: 'PHONE_NUMBER' }, text, GREGORIAN)
        ).toMatchObject({
            ok: false,
            problem: { message: 'Enter a valid phone number' },
        })
)

test('a one-digit hour is padded', () => {
    expect(parseTyped({ valueType: 'TIME' }, '9:30', GREGORIAN)).toEqual({
        ok: true,
        value: '09:30',
    })
    expect(
        parseTyped({ valueType: 'DATETIME' }, '2026-10-20 9:30', GREGORIAN)
    ).toEqual({ ok: true, value: '2026-10-20T09:30' })
    expect(parseTyped({ valueType: 'TIME' }, '9:5', GREGORIAN)).toMatchObject({
        ok: false,
        problem: { message: 'Enter a valid time' },
    })
})

test('an option name with spaces around it is shown trimmed and typed back', () => {
    const field = {
        valueType: 'TEXT',
        options: [{ code: 'O', name: 'Other ' }],
    }
    expect(typedText(field, 'O', GREGORIAN)).toBe('Other')
    expect(
        parseTyped(field, typedText(field, 'O', GREGORIAN), GREGORIAN)
    ).toEqual({ ok: true, value: 'O' })
})
