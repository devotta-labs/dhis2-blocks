import i18n from '@dhis2/d2-i18n'
import { parseCoordinate } from '@/components/dhis2-value-types'
import { coordinateToStored } from '@/components/dhis2-value-types/coordinate'
import {
    formatArea,
    geometrySchema,
    opened,
    ringHectares,
    rounded,
    type Position,
} from '@/components/location-map'

/** A position as people write it, latitude first: `8.1061, -11.4174`. */
export const positionText = ([lng, lat]: Position) => `${lat}, ${lng}`

/** What a typed or pasted coordinate is: nothing, a position, or text that is not one. */
export type ReadPoint =
    | { kind: 'empty' }
    | { kind: 'point'; position: Position }
    | { kind: 'wrong' }

/**
 * A coordinate as typed or pasted: `lat, lng`, the stored `[lng,lat]`, degrees, minutes and seconds with hemisphere
 * letters, or a maps link. Rounded to six places, about 10 cm.
 */
export const readPoint = (text: string): ReadPoint => {
    const trimmed = text.trim()
    if (trimmed === '') return { kind: 'empty' }
    const read = parseCoordinate(coordinateToStored(trimmed))
    if (read === undefined) return { kind: 'wrong' }
    return {
        kind: 'point',
        position: rounded([Number(read.longitude), Number(read.latitude)]),
    }
}

/**
 * The outer boundary in pasted GeoJSON: a polygon or a multi-polygon of one part, as a MULTI_POLYGON stage stores an
 * area, alone, in a feature, or as a feature collection's first.
 */
const ringInJson = (text: string): Position[] | undefined => {
    let json: ReturnType<typeof JSON.parse>
    try {
        json = JSON.parse(text)
    } catch {
        return undefined
    }
    const candidates = [json, json?.geometry, json?.features?.[0]?.geometry]
    for (const candidate of candidates) {
        const read = geometrySchema.safeParse(candidate)
        if (!read.success) continue
        const { data } = read
        if (data.type === 'Polygon') return opened(data.coordinates[0] ?? [])
        if (data.type === 'MultiPolygon' && data.coordinates.length === 1) {
            return opened(data.coordinates[0]?.[0] ?? [])
        }
    }
    return undefined
}

/**
 * The points in pasted text: a GeoJSON polygon, or coordinates one per line or apart by `;`, each in any form
 * `readPoint` takes. Nothing when any part is not a coordinate, or there are none.
 */
export const readPoints = (text: string): Position[] | undefined => {
    const fromJson = ringInJson(text.trim())
    if (fromJson !== undefined) return fromJson.map(rounded)
    const lines = text
        .split(/[\n;]/)
        .map((line) => line.trim())
        .filter(Boolean)
    const points = lines.flatMap((line) => {
        const read = readPoint(line)
        return read.kind === 'point' ? [read.position] : []
    })
    return lines.length > 0 && points.length === lines.length
        ? opened(points)
        : undefined
}

/** An area's size in its box: "5 points · 1.2 ha"; empty for none. */
export const areaSummary = (ring: readonly Position[]) => {
    if (ring.length === 0) return ''
    if (ring.length < 3) {
        return i18n.t('{{count}} points', { count: ring.length })
    }
    return i18n.t('{{count}} points · {{area}}', {
        count: ring.length,
        area: formatArea(ringHectares(ring)),
    })
}

/** How good a fix is, by its accuracy radius in metres: good to 10 m, fair to 30 m, poor beyond. */
export const accuracyBand = (metres: number): 'good' | 'fair' | 'poor' => {
    if (metres <= 10) return 'good'
    return metres <= 30 ? 'fair' : 'poor'
}
