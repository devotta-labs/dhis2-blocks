import { parseCoordinate } from './valueTypes'

test('parseCoordinate reads a stored [lng,lat]', () => {
    expect(parseCoordinate('[-11.5,8.25]')).toEqual({
        longitude: '-11.5',
        latitude: '8.25',
    })
    expect(parseCoordinate('[1.5E-4,8.2]')).toBeUndefined()
    expect(parseCoordinate('[200,8]')).toBeUndefined()
    expect(parseCoordinate('8.2,-11.5')).toBeUndefined()
})
