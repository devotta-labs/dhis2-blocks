import { coordinateNumber, parseCoordinate } from './coordinate'
import { parseTyped } from './valueTypes'

const GREGORIAN = { calendar: 'iso8601', dateFormat: 'YYYY-MM-DD' } as const

test('parseCoordinate reads a stored [lng,lat]', () => {
    expect(parseCoordinate('[-11.5,8.25]')).toEqual({
        longitude: '-11.5',
        latitude: '8.25',
    })
    expect(parseCoordinate('[1.5E-4,8.2]')).toBeUndefined()
    expect(parseCoordinate('[200,8]')).toBeUndefined()
    expect(parseCoordinate('8.2,-11.5')).toBeUndefined()
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
    // Degrees, minutes and seconds: the hemisphere letters say which is which, before or after, in either order.
    [`8°29'13.6"N 13°14'08.2"W`, '[-13.235611,8.487111]'],
    [`13° 14' 8.2" W, 8° 29' 13.6" N`, '[-13.235611,8.487111]'],
    ['S 8°30′ E 13°15′', '[13.25,-8.5]'],
    ['8.4871° N, 13.2356° W', '[-13.2356,8.4871]'],
    ['8.4871n 13.2356w', '[-13.2356,8.4871]'],
    // A "lat,lng" pair inside a maps link or other text.
    ['https://www.google.com/maps/@8.4871,-13.2356,15z', '[-13.2356,8.4871]'],
    ['https://maps.google.com/?q=8.4871,-13.2356', '[-13.2356,8.4871]'],
    ['Clinic at 8.4871, -13.2356 (main road)', '[-13.2356,8.4871]'],
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
    // Out of range, however it is written.
    `91°N 10°E`,
    `8°60'N 10°E`,
    'https://www.google.com/maps/@91.5,-13.2356,15z',
    // Two latitudes, a letter on both sides, or no letter at all.
    `8°N 10°S`,
    `N8°N 10°E`,
    `8° 10°`,
    // Numbers without other text are never searched for a pair.
    '8.1,1.2,3.3',
    'somewhere near the river',
    'https://example.org/maps',
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
