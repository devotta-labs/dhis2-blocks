import { describe, expect, it } from 'vitest'
import type { MapGeometry, Position } from '@/components/location-map'
import { areaPlace, pointPlace } from '../place'

const FACILITY: Position = [-11.4197, 8.1039]
const clinic = {
    name: 'Ngelehun CHC',
    geometry: { type: 'Point', coordinates: FACILITY } satisfies MapGeometry,
}
const district = {
    name: 'Badjia',
    geometry: {
        type: 'Polygon',
        coordinates: [
            [
                [-11.45, 8.08],
                [-11.39, 8.08],
                [-11.39, 8.13],
                [-11.45, 8.13],
                [-11.45, 8.08],
            ],
        ],
    } satisfies MapGeometry,
}

describe('the place a location is said to be', () => {
    it('says how far and which way from a point org unit, to the nearest 10 m', () => {
        // About 350 m north-east.
        expect(pointPlace([-11.4174, 8.1061], clinic)).toBe(
            '350 m north-east of Ngelehun CHC'
        )
        expect(pointPlace([-11.4197, 8.0939], clinic)).toBe(
            '1.1 km south of Ngelehun CHC'
        )
        expect(pointPlace([-11.4198, 8.104], clinic)).toBe('At Ngelehun CHC')
    })

    it('says inside or outside an area org unit, and nothing without geometry', () => {
        expect(pointPlace([-11.42, 8.1], district)).toBe('Inside Badjia')
        expect(pointPlace([-11.3, 8.1], district)).toBe('Outside Badjia')
        expect(pointPlace([-11.42, 8.1], { name: 'Bo' })).toBeUndefined()
        expect(pointPlace([-11.42, 8.1], undefined)).toBeUndefined()
    })

    it('gives an area its size, and where it is when that is not a warning', () => {
        const plot: Position[] = [
            [-11.4182, 8.1052],
            [-11.4168, 8.1058],
            [-11.4159, 8.1049],
            [-11.4164, 8.1038],
            [-11.4179, 8.1041],
        ]
        expect(areaPlace(plot, district)).toMatch(/^\S+ ha · inside Badjia$/)
        expect(areaPlace(plot, clinic)).toMatch(
            /^\S+ ha · \d+ m east of Ngelehun CHC$/
        )
        const outside = plot.map(([lng, lat]): Position => [lng + 0.1, lat])
        expect(areaPlace(outside, district)).toMatch(/^\S+ ha$/)
    })
})
