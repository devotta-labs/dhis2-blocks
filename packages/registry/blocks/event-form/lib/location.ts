import i18n from '@dhis2/d2-i18n'
import { z } from 'zod'
import { parseCoordinate } from '@/components/dhis2-value-types'
import type { HeldEvent } from './metadata'

// GeoJSON: longitude first; an altitude may follow.
const position = z.tuple([z.number(), z.number()], z.number())
type Position = z.infer<typeof position>
type Ring = readonly Position[]

/** A point or an area, as DHIS2 holds an org unit's or an event's geometry. */
export const geometrySchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('Point'), coordinates: position }),
    z.object({
        type: z.literal('Polygon'),
        coordinates: z.array(z.array(position)),
    }),
    z.object({
        type: z.literal('MultiPolygon'),
        coordinates: z.array(z.array(z.array(position))),
    }),
])

export type Geometry = z.infer<typeof geometrySchema>

/** The org unit an event is at, as its location is checked against it. */
export interface PlaceOrgUnit {
    name: string
    geometry?: Geometry
}

/** A stored geometry as the coordinate value `[lng,lat]`, when it is a point. */
export const pointValue = (
    geometry: HeldEvent['geometry']
): string | undefined => {
    const read = geometrySchema.safeParse(geometry)
    return read.success && read.data.type === 'Point'
        ? `[${read.data.coordinates[0]},${read.data.coordinates[1]}]`
        : undefined
}

/** A coordinate value `[lng,lat]` as a GeoJSON point. */
export const pointGeometry = (
    value: string
): { type: 'Point'; coordinates: [number, number] } | undefined => {
    const read = parseCoordinate(value)
    return (
        read && {
            type: 'Point',
            coordinates: [Number(read.longitude), Number(read.latitude)],
        }
    )
}

const EARTH_RADIUS_KM = 6371.0088
const radians = (degrees: number) => (degrees * Math.PI) / 180

/** The great-circle distance between two positions, in kilometres. */
export const distanceKm = ([lng1, lat1]: Position, [lng2, lat2]: Position) => {
    const half =
        Math.sin(radians(lat2 - lat1) / 2) ** 2 +
        Math.cos(radians(lat1)) *
            Math.cos(radians(lat2)) *
            Math.sin(radians(lng2 - lng1) / 2) ** 2
    return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(half)))
}

/** Whether a ray from the point eastwards crosses the ring an odd number of times. */
const inRing = ([x, y]: Position, ring: Ring) => {
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
 * Whether a position lies in an area: in a polygon's outer ring and in none of its holes, for any polygon of a
 * multi-polygon. shortcut: flat geometry, wrong for areas across the antimeridian or around a pole; none in DHIS2 data
 * we know of.
 */
export const insideArea = (
    point: Position,
    area: Extract<Geometry, { type: 'Polygon' | 'MultiPolygon' }>
) =>
    (area.type === 'Polygon' ? [area.coordinates] : area.coordinates).some(
        ([outer = [], ...holes]) =>
            inRing(point, outer) && !holes.some((hole) => inRing(point, hole))
    )

const locale = () => {
    try {
        // DHIS2 writes locales as `en_US`; Intl expects `en-US`.
        return Intl.getCanonicalLocales(i18n.language?.replace(/_/g, '-'))
    } catch {
        return []
    }
}

/** A distance in words: metres under a kilometre, one decimal under ten kilometres, whole kilometres beyond. */
export const formatDistance = (km: number) =>
    km < 1
        ? new Intl.NumberFormat(locale(), {
              style: 'unit',
              unit: 'meter',
              maximumFractionDigits: 0,
          }).format(km * 1000)
        : new Intl.NumberFormat(locale(), {
              style: 'unit',
              unit: 'kilometer',
              maximumFractionDigits: km < 10 ? 1 : 0,
          }).format(km)

// Names are text, not HTML.
const AS_IS = { interpolation: { escapeValue: false } }

/**
 * What a location says against its org unit: how far it is from a point org unit, warning past `farKm`, or whether it
 * is inside an org unit's area. Nothing when either has no geometry.
 */
export const plausibility = (
    value: string | undefined,
    orgUnit: PlaceOrgUnit | undefined,
    farKm: number
): { tone: 'info' | 'warning'; text: string } | undefined => {
    const point = value && pointGeometry(value)
    if (!point || orgUnit?.geometry === undefined) {
        return undefined
    }
    const { geometry } = orgUnit
    const where = point.coordinates
    if (geometry.type === 'Point') {
        const km = distanceKm(where, geometry.coordinates)
        const distance = formatDistance(km)
        return km > farKm
            ? {
                  tone: 'warning',
                  text: i18n.t(
                      'This point is {{distance}} from {{name}}. Check the latitude and longitude are the right way round.',
                      { ...AS_IS, distance, name: orgUnit.name }
                  ),
              }
            : {
                  tone: 'info',
                  text: i18n.t('{{distance}} from {{name}}', {
                      ...AS_IS,
                      distance,
                      name: orgUnit.name,
                  }),
              }
    }
    return insideArea(where, geometry)
        ? {
              tone: 'info',
              text: i18n.t('Inside {{name}}', { ...AS_IS, name: orgUnit.name }),
          }
        : {
              tone: 'warning',
              text: i18n.t('Outside {{name}}', {
                  ...AS_IS,
                  name: orgUnit.name,
              }),
          }
}
