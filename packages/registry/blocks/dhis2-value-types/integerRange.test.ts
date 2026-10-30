import { checkStored, parseTyped } from './valueTypes'

const GREGORIAN = { calendar: 'iso8601', dateFormat: 'YYYY-MM-DD' } as const

const OUT_OF_RANGE = {
    code: 'integerRange',
    message: 'Enter a whole number between -2147483648 and 2147483647',
}

test.each([
    ['INTEGER', '2147483648'],
    ['INTEGER', '-2147483649'],
    ['INTEGER_POSITIVE', '3000000000'],
    ['INTEGER_POSITIVE', '99999999999999999999'],
    ['INTEGER_NEGATIVE', '-3000000000'],
    ['INTEGER_ZERO_OR_POSITIVE', '3000000000'],
])('%s refuses %s as beyond the integers DHIS2 stores', (valueType, text) => {
    expect(parseTyped({ valueType }, text, GREGORIAN)).toEqual({
        ok: false,
        problem: OUT_OF_RANGE,
    })
    expect(checkStored({ valueType }, text)).toEqual(OUT_OF_RANGE)
})

test.each([
    ['INTEGER', '-2147483648'],
    ['INTEGER_POSITIVE', '2147483647'],
    ['INTEGER_NEGATIVE', '-2147483648'],
    ['INTEGER_ZERO_OR_POSITIVE', '2147483647'],
])('%s accepts %s, the end of DHIS2’s range', (valueType, text) =>
    expect(checkStored({ valueType }, text)).toBeUndefined()
)

test('a whole number that does not match its type is not a range problem', () =>
    expect(
        checkStored({ valueType: 'INTEGER_POSITIVE' }, '-3000000000')
    ).toMatchObject({ code: 'integerPositive' }))
