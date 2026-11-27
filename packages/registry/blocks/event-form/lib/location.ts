import i18n from '@dhis2/d2-i18n'
import { geometrySchema } from '@/components/location-map'
import type { MapGeometry } from '@/components/location-map'
import type { FeatureType, HeldEvent } from './metadata'

/** What the event's location field captures for a stage's feature type; nothing for a stage that records none. */
export const captureOf = (
    featureType: FeatureType
): 'point' | 'area' | undefined => {
    if (featureType === 'POINT') {
        return 'point'
    }
    return featureType === 'NONE' ? undefined : 'area'
}

/** The location field's label, as the Capture app names it. */
export const locationLabel = (capture: 'point' | 'area') =>
    capture === 'point' ? i18n.t('Coordinate') : i18n.t('Area')

/**
 * A stored geometry as the form holds it: GeoJSON written out, with an area of one part as a polygon, so the field can
 * edit it on a `MULTI_POLYGON` stage too. Nothing for a geometry it cannot read, which a save then leaves as it is.
 */
export const heldLocation = (
    geometry: HeldEvent['geometry']
): string | undefined => {
    const read = geometrySchema.safeParse(geometry)
    if (!read.success) {
        return undefined
    }
    const [only, ...more] =
        read.data.type === 'MultiPolygon' ? read.data.coordinates : []
    return JSON.stringify(
        only !== undefined && more.length === 0
            ? { type: 'Polygon', coordinates: only }
            : read.data
    )
}

/** The location the form holds as the field takes it; `null` for none. */
export const readLocation = (location: string | undefined) => {
    if (location === undefined) {
        return null
    }
    const read = geometrySchema.safeParse(JSON.parse(location))
    return read.success ? read.data : null
}

/**
 * The geometry a save sends. DHIS2 refuses one whose type is not the stage's (E1012), so an area goes to a
 * `MULTI_POLYGON` stage as a multi-polygon of one part.
 */
export const sentGeometry = (
    location: string,
    featureType: FeatureType
): MapGeometry | null => {
    const geometry = readLocation(location)
    return geometry?.type === 'Polygon' && featureType === 'MULTI_POLYGON'
        ? { type: 'MultiPolygon', coordinates: [geometry.coordinates] }
        : geometry
}
