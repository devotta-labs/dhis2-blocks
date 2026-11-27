import { describe, expect, it } from 'vitest'
import {
    bandPositions,
    bearing,
    changedAtEnd,
    crossesItself,
    distanceKm,
    editableRing,
    geometrySchema,
    insertionIndex,
    insideArea,
    polygonOf,
    ringHectares,
    type Position,
} from '../geometry'

// About 111 m a side at the equator.
const A: Position = [0, 0]
const B: Position = [0.001, 0]
const C: Position = [0.001, 0.001]
const D: Position = [0, 0.001]
const SQUARE = [A, B, C, D]

describe('location geometry', () => {
    it('closes a boundary for DHIS2 and opens it again for editing', () => {
        const polygon = polygonOf(SQUARE)
        expect(polygon.coordinates[0]).toHaveLength(5)
        expect(editableRing(polygon)).toEqual(SQUARE)
    })

    it('edits only an area with one boundary', () => {
        const holed = {
            type: 'Polygon' as const,
            coordinates: [polygonOf(SQUARE).coordinates[0] ?? [], [A, B, C, A]],
        }
        expect(editableRing(holed)).toBeUndefined()
        expect(editableRing({ type: 'Point', coordinates: A })).toBeUndefined()
    })

    it('measures a boundary in hectares, whichever way round', () => {
        expect(ringHectares(SQUARE)).toBeCloseTo(1.236, 2)
        expect(ringHectares([...SQUARE].reverse())).toBeCloseTo(1.236, 2)
    })

    it('says when a boundary crosses itself', () => {
        expect(crossesItself(SQUARE)).toBe(false)
        expect(crossesItself([A, C, B, D])).toBe(true)
    })

    it('puts a new corner into the side it bends least', () => {
        expect(insertionIndex([A, B], C)).toBe(2)
        // Just outside the side from B to C.
        expect(insertionIndex(SQUARE, [0.0012, 0.0005])).toBe(2)
    })

    it('knows distance, direction and inside', () => {
        expect(distanceKm(A, [0, 1])).toBeCloseTo(111.2, 0)
        expect(bearing(A, [0, 1])).toBeCloseTo(0, 5)
        expect(bearing(A, [1, 0])).toBeCloseTo(90, 5)
        expect(insideArea([0.0005, 0.0005], polygonOf(SQUARE))).toBe(true)
        expect(insideArea([0.002, 0.0005], polygonOf(SQUARE))).toBe(false)
    })

    it('draws the band from the corners a click would join', () => {
        expect(bandPositions([], A)).toEqual([])
        expect(bandPositions([A], B)).toEqual([A, B])
        const east: Position = [0.0015, 0.0005]
        expect(bandPositions(SQUARE, east)).toEqual([B, east, C])
    })
})

describe('changedAtEnd', () => {
    it('is true only for one point added or taken away at the end', () => {
        const a: Position = [0, 0]
        const b: Position = [1, 0]
        const c: Position = [1, 1]
        expect(changedAtEnd([a, b], [a, b, c])).toBe(true)
        expect(changedAtEnd([a, b, c], [a, b])).toBe(true)
        expect(changedAtEnd([a, c], [a, b, c])).toBe(false)
        expect(changedAtEnd([], [a, b, c])).toBe(false)
        expect(changedAtEnd([a, b, c], [a, b, c])).toBe(false)
    })

    it('refuses a position off the globe', () => {
        expect(
            geometrySchema.safeParse({
                type: 'Point',
                coordinates: [-11.4, 95],
            }).success
        ).toBe(false)
        expect(
            geometrySchema.safeParse({ type: 'Point', coordinates: [190, 8.1] })
                .success
        ).toBe(false)
        expect(
            geometrySchema.safeParse({
                type: 'Point',
                coordinates: [-11.4, 8.1],
            }).success
        ).toBe(true)
    })
})
