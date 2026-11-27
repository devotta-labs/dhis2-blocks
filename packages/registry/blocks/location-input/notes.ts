import i18n from '@dhis2/d2-i18n'
import {
    crossesItself,
    distanceKm,
    formatDistance,
    crossesArea,
    insideArea,
    middle,
    type Position,
} from '@/components/location-map'
import type { LocationOrgUnit } from './types'

/** One thing the line under the field says. */
export interface Note {
    tone: 'info' | 'warning'
    text: string
}

// Names are text, not HTML.
const AS_IS = { interpolation: { escapeValue: false } }

/** Where a point lies against its org unit: how far from a point org unit, or whether inside its boundary. */
export const pointNotes = (
    point: Position | undefined,
    orgUnit: LocationOrgUnit | undefined,
    warnKm: number | undefined
): Note[] => {
    const unit = orgUnit?.geometry
    if (point === undefined || orgUnit === undefined || !unit) return []
    const name = { ...AS_IS, name: orgUnit.name }
    if (unit.type === 'Point') {
        const km = distanceKm(point, unit.coordinates)
        const distance = formatDistance(km)
        if (warnKm !== undefined && km > warnKm) {
            return [
                {
                    tone: 'warning',
                    text: i18n.t(
                        '{{distance}} from {{name}}. Check latitude and longitude are not swapped.',
                        { ...name, distance }
                    ),
                },
            ]
        }
        return [
            {
                tone: 'info',
                text: i18n.t('{{distance}} from {{name}}', {
                    ...name,
                    distance,
                }),
            },
        ]
    }
    return insideArea(point, unit)
        ? [{ tone: 'info', text: i18n.t('Inside {{name}}', name) }]
        : [{ tone: 'warning', text: i18n.t('Outside {{name}}', name) }]
}

/** What an area says against itself and its org unit, warnings first. */
export const areaNotes = (
    ring: readonly Position[],
    orgUnit: LocationOrgUnit | undefined
): Note[] => {
    if (ring.length === 0) return []
    if (ring.length < 3) {
        return [
            {
                tone: 'warning',
                text: i18n.t('An area needs at least 3 points'),
            },
        ]
    }
    const said: Note[] = []
    if (crossesItself(ring)) {
        said.push({
            tone: 'warning',
            text: i18n.t('The boundary crosses itself'),
        })
    }
    const unit = orgUnit?.geometry
    if (orgUnit === undefined || !unit) return said
    const name = { ...AS_IS, name: orgUnit.name }
    if (unit.type === 'Point') {
        said.push({
            tone: 'info',
            text: i18n.t('{{distance}} from {{name}}', {
                ...name,
                distance: formatDistance(
                    distanceKm(middle(ring), unit.coordinates)
                ),
            }),
        })
        return said
    }
    const inside = ring.filter((point) => insideArea(point, unit)).length
    if (inside === ring.length && !crossesArea(ring, unit)) {
        said.push({ tone: 'info', text: i18n.t('Inside {{name}}', name) })
    } else {
        said.unshift({
            tone: 'warning',
            text:
                inside === 0
                    ? i18n.t('Outside {{name}}', name)
                    : i18n.t('Partly outside {{name}}', name),
        })
    }
    return said
}
