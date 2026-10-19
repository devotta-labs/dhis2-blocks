import type { DataElementMeta } from '../api/schemas'
import {
    answerChoices,
    getValueTypeSpec,
    isSupportedValueType,
    type InputMode,
    type ValueError,
} from './valueTypes'

const meta = (
    valueType: string,
    extra: Partial<DataElementMeta> = {}
): DataElementMeta => ({
    id: 'deAbcdefgh1',
    label: 'Element',
    valueType,
    compulsory: false,
    allowFutureDate: false,
    ...extra,
})

const optionsOf = (count: number) =>
    Array.from({ length: count }, (_, index) => ({
        id: `opt${index}`,
        code: `code${index}`,
        label: `Option ${index}`,
    }))

const CASES: [valueType: string, valid: string[], invalid: string[]][] = [
    ['INTEGER_POSITIVE', ['1'], ['0', '1.5']],
    ['INTEGER_NEGATIVE', ['-1'], ['0']],
    ['INTEGER_ZERO_OR_POSITIVE', ['0'], ['-1']],
    ['INTEGER', ['-3', '0'], ['1.5', 'abc']],
    ['NUMBER', ['1e3', '-1.5'], ['abc']],
    ['PERCENTAGE', ['0', '100'], ['101']],
    ['UNIT_INTERVAL', ['0.5'], ['1.01']],
    ['LETTER', ['a'], ['ab']],
    ['EMAIL', ['a@b.co'], ['a@']],
    ['PHONE_NUMBER', ['+232 76 123456'], ['abc']],
    ['URL', ['https://dhis2.org'], ['dhis2']],
    ['DATE', ['2026-03-12'], ['2026-13-01', '2026-02-30']],
    ['DATETIME', ['2026-03-12T10:30:00.000'], ['2026-03-12', 'nope']],
    ['TIME', ['10:30'], ['25:00']],
    ['AGE', ['2020-01-01'], ['abc']],
    ['COORDINATE', ['[-11.2,8.4]'], ['[200,8]']],
    ['ORGANISATION_UNIT', ['DiszpKrYNg8'], ['x']],
    ['BOOLEAN', ['true', 'false'], ['yes']],
    ['TRUE_ONLY', ['true'], ['false']],
]

describe('getValueTypeSpec validate', () => {
    it.each(CASES)('%s', (valueType, valid, invalid) => {
        const { validate } = getValueTypeSpec(meta(valueType))
        for (const value of valid) {
            expect(validate(value), `${valueType} ${value}`).toBeNull()
        }
        for (const value of invalid) {
            const error: ValueError | null = validate(value)
            expect(error, `${valueType} ${value}`).not.toBeNull()
            expect(error?.code).toEqual(expect.any(String))
            expect(error?.message).toEqual(expect.any(String))
        }
    })

    it('accepts an empty value, leaving required checks to the form', () => {
        expect(getValueTypeSpec(meta('INTEGER')).validate('')).toBeNull()
    })
})

describe('field mask', () => {
    it('rejects a value that does not match the whole mask', () => {
        const { validate } = getValueTypeSpec(
            meta('TEXT', { fieldMask: '\\d{3}' })
        )
        expect(validate('12')).not.toBeNull()
        expect(validate('1234')).not.toBeNull()
        expect(validate('123')).toBeNull()
    })

    it('supports the \\d \\x \\X \\w tokens and quoted masks', () => {
        const { validate } = getValueTypeSpec(
            meta('TEXT', { fieldMask: "'\\d\\d-\\X\\x\\w'" })
        )
        expect(validate('12-Ab7')).toBeNull()
        expect(validate('12-ab7')).not.toBeNull()
    })

    it('ignores an invalid mask and masks on types or option sets that do not take one', () => {
        expect(
            getValueTypeSpec(meta('TEXT', { fieldMask: '[' })).validate('x')
        ).toBeNull()
        expect(
            getValueTypeSpec(meta('DATE', { fieldMask: '\\d{3}' })).validate(
                '2026-03-12'
            )
        ).toBeNull()
        expect(
            getValueTypeSpec(
                meta('TEXT', { fieldMask: '\\d{3}', options: optionsOf(2) })
            ).validate('code0')
        ).toBeNull()
    })
})

describe('widget kinds', () => {
    it.each([
        ['TEXT', 'text'],
        ['LONG_TEXT', 'longText'],
        ['INTEGER', 'number'],
        ['NUMBER', 'number'],
        ['PERCENTAGE', 'number'],
        ['BOOLEAN', 'choice'],
        ['TRUE_ONLY', 'trueOnly'],
        ['DATE', 'date'],
        ['DATETIME', 'dateTime'],
        ['TIME', 'time'],
        ['AGE', 'age'],
        ['COORDINATE', 'coordinate'],
        ['ORGANISATION_UNIT', 'orgUnit'],
        ['EMAIL', 'text'],
        ['LETTER', 'text'],
        ['FILE_RESOURCE', 'unsupported'],
        ['IMAGE', 'unsupported'],
        ['MULTI_TEXT', 'unsupported'],
        ['SOMETHING_NEW', 'unsupported'],
    ])('%s is %s', (valueType, kind) => {
        expect(getValueTypeSpec(meta(valueType)).kind).toBe(kind)
    })

    it('uses choice for option sets of up to 5 options and select above', () => {
        expect(
            getValueTypeSpec(meta('TEXT', { options: optionsOf(5) })).kind
        ).toBe('choice')
        expect(
            getValueTypeSpec(meta('TEXT', { options: optionsOf(6) })).kind
        ).toBe('select')
    })

    it('uses multiSelect for MULTI_TEXT with an option set', () => {
        expect(
            getValueTypeSpec(meta('MULTI_TEXT', { options: optionsOf(2) })).kind
        ).toBe('multiSelect')
    })

    it('treats an empty option set as unsupported, since no answer could be given', () => {
        expect(getValueTypeSpec(meta('TEXT', { options: [] })).kind).toBe(
            'unsupported'
        )
        expect(getValueTypeSpec(meta('MULTI_TEXT', { options: [] })).kind).toBe(
            'unsupported'
        )
        expect(isSupportedValueType(meta('TEXT', { options: [] }))).toBe(false)
        // BOOLEAN's choices come from the type, not an option set.
        expect(getValueTypeSpec(meta('BOOLEAN', { options: [] })).kind).toBe(
            'choice'
        )
    })

    it('keeps unsupported value types unsupported even with an option set', () => {
        expect(
            getValueTypeSpec(meta('FILE_RESOURCE', { options: optionsOf(2) }))
                .kind
        ).toBe('unsupported')
    })

    it('reports supported value types', () => {
        expect(isSupportedValueType(meta('TEXT'))).toBe(true)
        expect(isSupportedValueType(meta('FILE_RESOURCE'))).toBe(false)
        expect(isSupportedValueType(meta('MULTI_TEXT'))).toBe(false)
        expect(
            isSupportedValueType(meta('MULTI_TEXT', { options: optionsOf(1) }))
        ).toBe(true)
    })

    it('suggests an input mode for typed text', () => {
        const mode = (valueType: string): InputMode | undefined =>
            getValueTypeSpec(meta(valueType)).inputMode
        expect(mode('INTEGER')).toBe('numeric')
        expect(mode('NUMBER')).toBe('decimal')
        expect(mode('EMAIL')).toBe('email')
        expect(mode('PHONE_NUMBER')).toBe('tel')
        expect(mode('URL')).toBe('url')
        expect(mode('TEXT')).toBe('text')
        expect(mode('DATE')).toBeUndefined()
    })
})

describe('answerChoices', () => {
    it('gives Yes and No for BOOLEAN', () => {
        expect(answerChoices(meta('BOOLEAN'))).toEqual([
            { value: 'true', label: 'Yes' },
            { value: 'false', label: 'No' },
        ])
    })

    it('gives each option code and label for an option set', () => {
        expect(answerChoices(meta('TEXT', { options: optionsOf(2) }))).toEqual([
            { value: 'code0', label: 'Option 0' },
            { value: 'code1', label: 'Option 1' },
        ])
    })

    it('is empty without choices', () => {
        expect(answerChoices(meta('TEXT'))).toEqual([])
    })
})
