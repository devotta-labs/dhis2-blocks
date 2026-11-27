import {
    captureOf,
    heldLocation,
    locationLabel,
    readLocation,
    sentGeometry,
} from './location'

const RING = [
    [-12, 8],
    [-11, 8],
    [-11, 9],
    [-12, 8],
]
const AREA = { type: 'Polygon', coordinates: [RING] }

describe('captureOf', () => {
    it('captures a point, an area for either kind of polygon, and nothing for none', () => {
        expect(captureOf('POINT')).toBe('point')
        expect(captureOf('POLYGON')).toBe('area')
        expect(captureOf('MULTI_POLYGON')).toBe('area')
        expect(captureOf('NONE')).toBeUndefined()
    })

    it('labels the field as the Capture app does', () => {
        expect(locationLabel('point')).toBe('Coordinate')
        expect(locationLabel('area')).toBe('Area')
    })
})

describe('heldLocation', () => {
    it('writes out a stored point or polygon, without an altitude', () => {
        expect(
            heldLocation({ type: 'Point', coordinates: [-11.42, 8.47, 120] })
        ).toBe('{"type":"Point","coordinates":[-11.42,8.47]}')
        expect(heldLocation(AREA)).toBe(JSON.stringify(AREA))
    })

    it('holds a multi-polygon of one part as a polygon, and one of several as it is', () => {
        expect(
            heldLocation({ type: 'MultiPolygon', coordinates: [[RING]] })
        ).toBe(JSON.stringify(AREA))
        const parts = { type: 'MultiPolygon', coordinates: [[RING], [RING]] }
        expect(heldLocation(parts)).toBe(JSON.stringify(parts))
    })

    it('holds nothing for no geometry or one it cannot read', () => {
        expect(heldLocation(undefined)).toBeUndefined()
        expect(
            heldLocation({ type: 'Point', coordinates: [8.47, -191] })
        ).toBeUndefined()
        expect(
            heldLocation({ type: 'LineString', coordinates: RING })
        ).toBeUndefined()
    })
})

describe('readLocation', () => {
    it('gives the field the geometry held, or null for none', () => {
        expect(readLocation(JSON.stringify(AREA))).toEqual(AREA)
        expect(readLocation(undefined)).toBeNull()
    })
})

describe('sentGeometry', () => {
    it('sends an area to a MULTI_POLYGON stage as a multi-polygon of one part', () => {
        expect(sentGeometry(JSON.stringify(AREA), 'MULTI_POLYGON')).toEqual({
            type: 'MultiPolygon',
            coordinates: [[RING]],
        })
    })

    it('sends a polygon to a POLYGON stage, and a point to a POINT stage, as they are', () => {
        expect(sentGeometry(JSON.stringify(AREA), 'POLYGON')).toEqual(AREA)
        const point = { type: 'Point', coordinates: [-11.42, 8.47] }
        expect(sentGeometry(JSON.stringify(point), 'POINT')).toEqual(point)
    })
})
