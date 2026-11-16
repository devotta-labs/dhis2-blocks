import {
    distanceKm,
    formatDistance,
    insideArea,
    plausibility,
    pointGeometry,
    pointValue,
} from './location'
import type { Geometry } from './location'

const CHC = {
    name: 'Ngelehun CHC',
    geometry: { type: 'Point', coordinates: [-11.4197, 8.1039] },
} satisfies {
    name: string
    geometry: Geometry
}

// A square district with a square lake in it.
const DISTRICT: Geometry = {
    type: 'Polygon',
    coordinates: [
        [
            [-12, 8],
            [-11, 8],
            [-11, 9],
            [-12, 9],
            [-12, 8],
        ],
        [
            [-11.6, 8.4],
            [-11.4, 8.4],
            [-11.4, 8.6],
            [-11.6, 8.6],
            [-11.6, 8.4],
        ],
    ],
}

test('a stored point is the coordinate value [lng,lat], and back', () => {
    expect(pointValue({ type: 'Point', coordinates: [-11.42, 8.47] })).toBe(
        '[-11.42,8.47]'
    )
    expect(pointValue({ type: 'Polygon', coordinates: [] })).toBeUndefined()
    expect(pointValue(undefined)).toBeUndefined()
    expect(pointGeometry('[-11.42,8.47]')).toEqual({
        type: 'Point',
        coordinates: [-11.42, 8.47],
    })
    expect(pointGeometry('nowhere')).toBeUndefined()
})

test('distances are great-circle distances', () => {
    expect(distanceKm([0, 0], [0, 0])).toBe(0)
    // A degree of latitude is about 111 km.
    expect(distanceKm([0, 0], [0, 1])).toBeCloseTo(111.2, 1)
    // Freetown to Ngelehun CHC.
    expect(
        distanceKm([-13.2356, 8.4871], CHC.geometry.coordinates)
    ).toBeCloseTo(204, 0)
})

test('a swapped latitude and longitude lands thousands of kilometres away', () => {
    const swapped = distanceKm([8.1039, -11.4197], CHC.geometry.coordinates)
    expect(swapped).toBeGreaterThan(2000)
})

test('a point is inside an area when in its outer ring and not in a hole', () => {
    expect(insideArea([-11.8, 8.2], DISTRICT)).toBe(true)
    expect(insideArea([-11.5, 8.5], DISTRICT)).toBe(false)
    expect(insideArea([-10.5, 8.5], DISTRICT)).toBe(false)
})

test('a point is inside a multi-polygon when inside any of its polygons', () => {
    const islands: Geometry = {
        type: 'MultiPolygon',
        coordinates: [
            [
                [
                    [0, 0],
                    [1, 0],
                    [1, 1],
                    [0, 1],
                    [0, 0],
                ],
            ],
            [
                [
                    [5, 5],
                    [6, 5],
                    [6, 6],
                    [5, 6],
                    [5, 5],
                ],
            ],
        ],
    }
    expect(insideArea([5.5, 5.5], islands)).toBe(true)
    expect(insideArea([0.5, 0.5], islands)).toBe(true)
    expect(insideArea([3, 3], islands)).toBe(false)
})

test('distances are written in metres under a kilometre and kilometres beyond', () => {
    expect(formatDistance(0.012)).toBe('12 m')
    expect(formatDistance(3.24)).toBe('3.2 km')
    expect(formatDistance(5420.4)).toBe('5,420 km')
})

test('a location says how far it is from a point org unit, and warns when far', () => {
    expect(plausibility('[-11.39,8.12]', CHC, 100)).toEqual({
        tone: 'info',
        text: '3.7 km from Ngelehun CHC',
    })
    expect(plausibility('[8.1039,-11.4197]', CHC, 100)).toEqual({
        tone: 'warning',
        text: expect.stringMatching(
            /^This point is [\d,]+ km from Ngelehun CHC\. Check the latitude and longitude are the right way round\.$/
        ),
    })
})

test('a location says whether it is inside an org unit’s area', () => {
    const district = { name: 'Badjia', geometry: DISTRICT }
    expect(plausibility('[-11.8,8.2]', district, 100)).toEqual({
        tone: 'info',
        text: 'Inside Badjia',
    })
    expect(plausibility('[-11.5,8.5]', district, 100)).toEqual({
        tone: 'warning',
        text: 'Outside Badjia',
    })
})

test('nothing is said without a location or an org unit geometry', () => {
    expect(plausibility(undefined, CHC, 100)).toBeUndefined()
    expect(
        plausibility('[-11.39,8.12]', { name: 'Somewhere' }, 100)
    ).toBeUndefined()
    expect(plausibility('[-11.39,8.12]', undefined, 100)).toBeUndefined()
})
