import { z } from 'zod'
import { languageTags } from '@/components/dhis2-value-types'

/** GeoJSON order: longitude first. */
export type Position = [lng: number, lat: number]

export interface PointGeometry {
    type: 'Point'
    coordinates: Position
}

export interface PolygonGeometry {
    type: 'Polygon'
    coordinates: Position[][]
}

export interface MultiPolygonGeometry {
    type: 'MultiPolygon'
    coordinates: Position[][][]
}

/** What can be captured: one point, or one area with a single boundary. */
export type LocationGeometry = PointGeometry | PolygonGeometry

/** What can be shown: anything captured, and areas with holes or several parts, as DHIS2 may store them. */
export type MapGeometry = LocationGeometry | MultiPolygonGeometry

// An altitude after the two numbers is allowed and dropped.
const positionSchema = z
    .tuple(
        [z.number().min(-180).max(180), z.number().min(-90).max(90)],
        z.number()
    )
    .transform(([lng, lat]): Position => [lng, lat])
const ringSchema = z.array(positionSchema)

/** A geometry as DHIS2 sends it, for parsing at the boundary. */
export const geometrySchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('Point'), coordinates: positionSchema }),
    z.object({ type: z.literal('Polygon'), coordinates: z.array(ringSchema) }),
    z.object({
        type: z.literal('MultiPolygon'),
        coordinates: z.array(z.array(ringSchema)),
    }),
])

/** Degrees to six places, about 10 cm, as DHIS2 stores a coordinate. */
export const rounded = ([lng, lat]: readonly number[]): Position => [
    Number((lng ?? 0).toFixed(6)),
    Number((lat ?? 0).toFixed(6)),
]

const same = (a?: Position, b?: Position) =>
    a !== undefined && b !== undefined && a[0] === b[0] && a[1] === b[1]

/** A boundary without the closing repeat of its first point. */
export const opened = (ring: readonly Position[]): Position[] =>
    ring.length > 1 && same(ring[0], ring.at(-1))
        ? ring.slice(0, -1)
        : [...ring]

/** Whether one boundary is the other with a single point added or taken away at its end, as drawing and undoing do. */
export const changedAtEnd = (
    before: readonly Position[],
    after: readonly Position[]
) => {
    if (Math.abs(before.length - after.length) !== 1) return false
    const [shorter, longer] =
        before.length < after.length ? [before, after] : [after, before]
    return shorter.every((point, index) => same(point, longer[index]))
}

/** A point as GeoJSON. */
export const pointOf = (position: Position): PointGeometry => ({
    type: 'Point',
    coordinates: rounded(position),
})

/** An open boundary as the GeoJSON polygon DHIS2 stores: closed, one ring. */
export const polygonOf = (ring: readonly Position[]): PolygonGeometry => {
    const points = ring.map(rounded)
    const [first] = points
    return {
        type: 'Polygon',
        coordinates: [first === undefined ? [] : [...points, first]],
    }
}

/** The open boundary of an area this form can edit: one ring, no holes. Nothing for anything else. */
export const editableRing = (
    geometry: MapGeometry | null | undefined
): Position[] | undefined => {
    if (geometry?.type !== 'Polygon' || geometry.coordinates.length !== 1) {
        return undefined
    }
    return opened(geometry.coordinates[0] ?? [])
}

const EARTH_RADIUS_KM = 6371.0088
const radians = (degrees: number) => (degrees * Math.PI) / 180
const degrees = (value: number) => (value * 180) / Math.PI

/** The great-circle distance between two positions, in kilometres. */
export const distanceKm = ([lng1, lat1]: Position, [lng2, lat2]: Position) => {
    const half =
        Math.sin(radians(lat2 - lat1) / 2) ** 2 +
        Math.cos(radians(lat1)) *
            Math.cos(radians(lat2)) *
            Math.sin(radians(lng2 - lng1) / 2) ** 2
    return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(half)))
}

/** The compass direction from one position to another, in degrees from north. */
export const bearing = ([lng1, lat1]: Position, [lng2, lat2]: Position) => {
    const y = Math.sin(radians(lng2 - lng1)) * Math.cos(radians(lat2))
    const x =
        Math.cos(radians(lat1)) * Math.sin(radians(lat2)) -
        Math.sin(radians(lat1)) *
            Math.cos(radians(lat2)) *
            Math.cos(radians(lng2 - lng1))
    return (degrees(Math.atan2(y, x)) + 360) % 360
}

/** An open boundary's area on the sphere, in hectares. shortcut: wrong across the antimeridian or round a pole. */
export const ringHectares = (ring: readonly Position[]) => {
    let sum = 0
    for (let at = 0; at < ring.length; at++) {
        const [lng1, lat1] = ring[at] ?? [0, 0]
        const [lng2, lat2] = ring[(at + 1) % ring.length] ?? [0, 0]
        sum +=
            radians(lng2 - lng1) *
            (2 + Math.sin(radians(lat1)) + Math.sin(radians(lat2)))
    }
    return Math.abs((sum * (EARTH_RADIUS_KM * 1000) ** 2) / 2) / 10_000
}

/** The middle of a boundary's points, enough to say how far an area is from somewhere. */
export const middle = (ring: readonly Position[]): Position => [
    ring.reduce((sum, [lng]) => sum + lng, 0) / Math.max(1, ring.length),
    ring.reduce((sum, [, lat]) => sum + lat, 0) / Math.max(1, ring.length),
]

const cross = (o: Position, a: Position, b: Position) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

const sidesCross = (a: Position, b: Position, c: Position, d: Position) =>
    cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0

/** Whether any two sides of an open boundary, other than neighbours, cross. */
export const crossesItself = (ring: readonly Position[]) =>
    ring.some((a, first) => {
        const b = ring[(first + 1) % ring.length] ?? a
        return ring.some((c, second) => {
            const d = ring[(second + 1) % ring.length] ?? c
            // The last side meets the first at the start: neighbours too.
            const apart =
                second > first + 1 &&
                !(first === 0 && second === ring.length - 1)
            return apart && sidesCross(a, b, c, d)
        })
    })

/**
 * Whether an open boundary takes in land outside an area though its corners are all inside: a side crosses the area's
 * boundary, as across a bay, or the boundary runs inside it, as round a hole or another of the area's parts.
 */
export const crossesArea = (
    ring: readonly Position[],
    area: PolygonGeometry | MultiPolygonGeometry
) => {
    const edges =
        area.type === 'Polygon' ? area.coordinates : area.coordinates.flat()
    if (edges.some((edge) => edge.some((point) => inRing(point, ring)))) {
        return true
    }
    return ring.some((a, index) => {
        const b = ring[(index + 1) % ring.length] ?? a
        return edges.some((edge) =>
            edge.some((c, at) => {
                const d = edge[at + 1]
                return d !== undefined && sidesCross(a, b, c, d)
            })
        )
    })
}

/** Whether a ray from the point eastwards crosses the ring an odd number of times. */
const inRing = ([x, y]: Position, ring: readonly Position[]) => {
    let inside = false
    for (
        let at = 0, before = ring.length - 1;
        at < ring.length;
        before = at++
    ) {
        const [xi, yi] = ring[at] ?? [0, 0]
        const [xj, yj] = ring[before] ?? [0, 0]
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
            inside = !inside
        }
    }
    return inside
}

/**
 * Whether a position lies in an area: in an outer ring and in none of its holes. shortcut: flat geometry, wrong for
 * areas across the antimeridian or round a pole.
 */
export const insideArea = (
    point: Position,
    area: PolygonGeometry | MultiPolygonGeometry
) =>
    (area.type === 'Polygon' ? [area.coordinates] : area.coordinates).some(
        ([outer = [], ...holes]) =>
            inRing(point, outer) && !holes.some((hole) => inRing(point, hole))
    )

// Flat distance in degrees, scaled for longitude at the latitude: enough to compare the sides of a small area.
const apart = (a: Position, b: Position) => {
    const scale = Math.cos(radians((a[1] + b[1]) / 2))
    return Math.hypot((a[0] - b[0]) * scale, a[1] - b[1])
}

/**
 * Where a new corner goes: at the end while there are fewer than three, then into the side it lengthens least, so a
 * point placed beside a side bends that side rather than crossing the area.
 */
export const insertionIndex = (ring: readonly Position[], at: Position) => {
    if (ring.length < 3) return ring.length
    let best = ring.length
    let cost = Number.POSITIVE_INFINITY
    ring.forEach((from, index) => {
        const to = ring[(index + 1) % ring.length] ?? from
        const added = apart(from, at) + apart(at, to) - apart(from, to)
        if (added < cost) {
            cost = added
            best = index + 1
        }
    })
    return best
}

/** A distance in words: metres under a kilometre, one decimal under ten kilometres, whole kilometres beyond. */
export const formatDistance = (km: number) =>
    km < 1
        ? new Intl.NumberFormat(languageTags(), {
              style: 'unit',
              unit: 'meter',
              maximumFractionDigits: 0,
          }).format(km * 1000)
        : new Intl.NumberFormat(languageTags(), {
              style: 'unit',
              unit: 'kilometer',
              maximumFractionDigits: km < 10 ? 1 : 0,
          }).format(km)

/** An area in words: hectares, two decimals under ten, one under a hundred, whole beyond. */
export const formatArea = (hectares: number) => {
    let digits = 0
    if (hectares < 10) digits = 2
    else if (hectares < 100) digits = 1
    return new Intl.NumberFormat(languageTags(), {
        style: 'unit',
        unit: 'hectare',
        maximumFractionDigits: digits,
    }).format(hectares)
}

/** Every position a geometry draws, for framing it on a map. */
export const positionsOf = (geometry: MapGeometry): Position[] => {
    if (geometry.type === 'Point') return [geometry.coordinates]
    if (geometry.type === 'Polygon') return geometry.coordinates.flat()
    return geometry.coordinates.flat(2)
}

/**
 * The sides a click at `at` would add to the ring: from the corner before where it would be inserted, through `at`,
 * to the corner after. One corner gives a single side; none gives nothing.
 */
export const bandPositions = (
    ring: readonly Position[],
    at: Position
): Position[] => {
    const first = ring[0]
    if (first === undefined) return []
    if (ring.length === 1) return [first, at]
    const index = insertionIndex(ring, at)
    const before = ring[(index - 1 + ring.length) % ring.length] ?? first
    const after = ring[index % ring.length] ?? first
    return [before, at, after]
}
