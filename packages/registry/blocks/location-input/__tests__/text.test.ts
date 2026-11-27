import { describe, expect, it } from 'vitest'
import { pastedHoles, readPoint, readPoints } from '../text'

describe('location text', () => {
    it('reads a coordinate typed latitude first, in degrees or as stored', () => {
        expect(readPoint('8.1061, -11.4174')).toEqual({
            kind: 'point',
            position: [-11.4174, 8.1061],
        })
        expect(readPoint('[-11.4174,8.1061]')).toEqual({
            kind: 'point',
            position: [-11.4174, 8.1061],
        })
        expect(readPoint('  ')).toEqual({ kind: 'empty' })
        expect(readPoint('somewhere')).toEqual({ kind: 'wrong' })
    })

    it('reads pasted points one per line, or a GeoJSON polygon', () => {
        expect(readPoints('8.1, -11.4\n8.2, -11.5\n8.1, -11.6')).toEqual([
            [-11.4, 8.1],
            [-11.5, 8.2],
            [-11.6, 8.1],
        ])
        const polygon = {
            type: 'Polygon',
            coordinates: [
                [
                    [0, 0],
                    [1, 0],
                    [1, 1],
                    [0, 0],
                ],
            ],
        }
        expect(readPoints(JSON.stringify(polygon))).toEqual([
            [0, 0],
            [1, 0],
            [1, 1],
        ])
        expect(
            readPoints(JSON.stringify({ type: 'Feature', geometry: polygon }))
        ).toHaveLength(3)
        expect(
            readPoints(
                JSON.stringify({
                    type: 'MultiPolygon',
                    coordinates: [polygon.coordinates],
                })
            )
        ).toHaveLength(3)
        expect(
            readPoints(
                JSON.stringify({
                    type: 'MultiPolygon',
                    coordinates: [polygon.coordinates, polygon.coordinates],
                })
            )
        ).toBeUndefined()
        expect(readPoints('8.1, -11.4\nnot a place')).toBeUndefined()
    })

    it('refuses a pasted area with holes rather than dropping them', () => {
        const holed = {
            type: 'Polygon',
            coordinates: [
                [
                    [-11.4, 8.1],
                    [-11.3, 8.1],
                    [-11.3, 8.2],
                    [-11.4, 8.1],
                ],
                [
                    [-11.36, 8.12],
                    [-11.34, 8.12],
                    [-11.34, 8.14],
                    [-11.36, 8.12],
                ],
            ],
        }
        expect(pastedHoles(JSON.stringify(holed))).toBe(true)
        expect(readPoints(JSON.stringify(holed))).toBeUndefined()
        expect(
            pastedHoles(
                JSON.stringify({
                    type: 'MultiPolygon',
                    coordinates: [holed.coordinates],
                })
            )
        ).toBe(true)
        expect(pastedHoles('8.1, -11.4\n8.2, -11.5')).toBe(false)
    })
})
