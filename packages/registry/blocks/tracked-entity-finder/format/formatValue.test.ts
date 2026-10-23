import { describe, expect, it } from 'vitest'
import { hivProgram } from '../__tests__/fixtures/program'
import type { AttributeMetadata } from '../api/schemas'
import type { FinderSystemInfo } from '../api/systemInfo'
import { attributeOf, buildProgramModel } from '../rules/programModel'
import { formatValue } from './formatValue'

const gregorian: FinderSystemInfo = {
    calendar: 'gregorian',
    dateFormat: 'YYYY-MM-DD',
}
const ethiopian: FinderSystemInfo = {
    calendar: 'ethiopian',
    dateFormat: 'DD-MM-YYYY',
}

const extra = (id: string, valueType: string): AttributeMetadata => ({
    id,
    label: id,
    valueType,
    unique: false,
    searchable: false,
    displayInList: true,
    blockedSearchOperators: [],
    minCharactersToSearch: 0,
})

const model = buildProgramModel({
    ...hivProgram,
    attributes: [
        ...hivProgram.attributes,
        extra('hivPositive', 'BOOLEAN'),
        extra('consented', 'TRUE_ONLY'),
        extra('age', 'AGE'),
    ],
})
const attribute = (id: string) => {
    const found = attributeOf(model, id)
    if (!found) {
        throw new Error(`No ${id} in the test program`)
    }
    return found
}

describe('formatValue', () => {
    it('shows an option name in place of its code', () => {
        expect(formatValue(attribute('sex'), 'F', gregorian)).toBe('Female')
    })

    it('keeps a code that is not in the option set', () => {
        expect(formatValue(attribute('sex'), 'X', gregorian)).toBe('X')
    })

    it.each([
        ['dob', '2024-05-23', '15-09-2016'],
        ['dob', '2024-05-23T00:00:00.000', '15-09-2016'],
        ['age', '2024-09-11', '01-01-2017'],
    ])('shows %s %s on the system calendar', (id, raw, shown) => {
        expect(formatValue(attribute(id), raw, ethiopian)).toBe(shown)
    })

    it('shows a gregorian date in the system format', () => {
        expect(formatValue(attribute('dob'), '2024-05-23', gregorian)).toBe(
            '2024-05-23'
        )
    })

    it('shows a DATETIME as the calendar date and the time', () => {
        expect(
            formatValue(
                attribute('visit'),
                '2024-05-23T14:05:09.000',
                ethiopian
            )
        ).toBe('15-09-2016 14:05')
    })

    it('shows a DATETIME without a time as the date', () => {
        expect(formatValue(attribute('visit'), '2024-05-23', gregorian)).toBe(
            '2024-05-23'
        )
    })

    it('keeps a date it cannot read', () => {
        expect(formatValue(attribute('dob'), 'soon', ethiopian)).toBe('soon')
    })

    it.each([
        ['hivPositive', 'true', 'Yes'],
        ['hivPositive', 'false', 'No'],
        ['consented', 'true', 'Yes'],
    ])('shows %s %s as %s', (id, raw, shown) => {
        expect(formatValue(attribute(id), raw, gregorian)).toBe(shown)
    })

    it.each(['', '   '])('shows an empty value %j as a dash', (raw) => {
        expect(formatValue(attribute('firstName'), raw, gregorian)).toBe('—')
        expect(formatValue(undefined, raw, gregorian)).toBe('—')
    })

    it('shows the raw value for an attribute the program does not have', () => {
        expect(formatValue(undefined, '2024-05-23', ethiopian)).toBe(
            '2024-05-23'
        )
    })

    it('shows text as it is', () => {
        expect(formatValue(attribute('firstName'), 'Abebe', gregorian)).toBe(
            'Abebe'
        )
    })
})
