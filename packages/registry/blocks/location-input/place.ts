import i18n from '@dhis2/d2-i18n'
import {
    bearing,
    distanceKm,
    formatArea,
    formatDistance,
    insideArea,
    middle,
    ringHectares,
    type Position,
} from '@/components/location-map'
import type { LocationOrgUnit } from './types'

// Names are text, not HTML.
const AS_IS = { interpolation: { escapeValue: false } }

/** Closer than this to a point org unit, a point is at it. */
const AT_KM = 0.025

// Whole sentences, so each language can order the distance, the direction and the name as it needs.
const DIRECTIONS: readonly ((distance: string, name: string) => string)[] = [
    (distance, name) =>
        i18n.t('{{distance}} north of {{name}}', { ...AS_IS, distance, name }),
    (distance, name) =>
        i18n.t('{{distance}} north-east of {{name}}', {
            ...AS_IS,
            distance,
            name,
        }),
    (distance, name) =>
        i18n.t('{{distance}} east of {{name}}', { ...AS_IS, distance, name }),
    (distance, name) =>
        i18n.t('{{distance}} south-east of {{name}}', {
            ...AS_IS,
            distance,
            name,
        }),
    (distance, name) =>
        i18n.t('{{distance}} south of {{name}}', { ...AS_IS, distance, name }),
    (distance, name) =>
        i18n.t('{{distance}} south-west of {{name}}', {
            ...AS_IS,
            distance,
            name,
        }),
    (distance, name) =>
        i18n.t('{{distance}} west of {{name}}', { ...AS_IS, distance, name }),
    (distance, name) =>
        i18n.t('{{distance}} north-west of {{name}}', {
            ...AS_IS,
            distance,
            name,
        }),
]

/** A distance as people say it: to the nearest 10 m under a kilometre, then as `formatDistance` gives it. */
const roughDistance = (km: number) =>
    formatDistance(km < 1 ? Math.max(10, Math.round(km * 100) * 10) / 1000 : km)

/** Where `point` is from a point org unit: at it, or how far and which of eight ways. */
const fromPoint = (point: Position, unit: Position, name: string) => {
    const km = distanceKm(unit, point)
    if (km < AT_KM) return i18n.t('At {{name}}', { ...AS_IS, name })
    const way = Math.round(bearing(unit, point) / 45) % 8
    const say = DIRECTIONS[way] ?? DIRECTIONS[0]
    return say?.(roughDistance(km), name) ?? ''
}

/**
 * A point in words a health worker knows: how far and which way from the org unit's point, or whether it is inside
 * the org unit's area. Nothing when the org unit has no geometry.
 */
export const pointPlace = (
    point: Position,
    orgUnit: LocationOrgUnit | undefined
): string | undefined => {
    const unit = orgUnit?.geometry
    if (orgUnit === undefined || !unit) return undefined
    if (unit.type === 'Point') {
        return fromPoint(point, unit.coordinates, orgUnit.name)
    }
    return insideArea(point, unit)
        ? i18n.t('Inside {{name}}', { ...AS_IS, name: orgUnit.name })
        : i18n.t('Outside {{name}}', { ...AS_IS, name: orgUnit.name })
}

/**
 * An area in words: its size, and where it is from the org unit's point or that it lies inside the org unit's area.
 * Just its size when it is not inside, which the field warns of under it.
 */
export const areaPlace = (
    ring: readonly Position[],
    orgUnit: LocationOrgUnit | undefined
): string => {
    const size = formatArea(ringHectares(ring))
    const unit = orgUnit?.geometry
    if (orgUnit === undefined || !unit) return size
    if (unit.type === 'Point') {
        return i18n.t('{{size}} · {{place}}', {
            ...AS_IS,
            size,
            place: fromPoint(middle(ring), unit.coordinates, orgUnit.name),
        })
    }
    return ring.every((point) => insideArea(point, unit))
        ? i18n.t('{{size}} · inside {{name}}', {
              ...AS_IS,
              size,
              name: orgUnit.name,
          })
        : size
}
