import { textDirectionFor } from './valueTypes'

test.each([
    ['NUMBER', 'ltr'],
    ['PHONE_NUMBER', 'ltr'],
    ['DATE', 'ltr'],
    ['COORDINATE', 'ltr'],
    ['TEXT', 'auto'],
    ['LONG_TEXT', 'auto'],
    ['ORGANISATION_UNIT', 'auto'],
])('%s text reads %s', (valueType, dir) =>
    expect(textDirectionFor({ valueType })).toBe(dir)
)

test('option names follow their script, whatever the value type', () =>
    expect(
        textDirectionFor({
            valueType: 'NUMBER',
            options: [{ code: '1', name: 'واحد' }],
        })
    ).toBe('auto'))
