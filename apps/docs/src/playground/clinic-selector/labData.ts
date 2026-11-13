import type { LabNetwork } from '../network'

export type LabUser = 'u1' | 'u2'

export interface LabSettings {
    /** Clinics assigned on their own (0–20); they sit in the first district. */
    assignedClinics: number
    /** Districts assigned (0–3), so the user is assigned above clinic level. */
    assignedDistricts: number
    /** Clinics under each district (0–200). */
    clinicsPerDistrict: number
    longNames: boolean
    sameInitials: boolean
    userId: LabUser
    collapsed: boolean
    /**
     * The host's `value`: none; a clinic inside the user's scope, held whatever the user picks; the same clinic to
     * start, adopting each pick; one outside the scope; or an id no unit has.
     */
    value: 'uncontrolled' | 'valid' | 'follows' | 'outside' | 'missing'
    label: 'Clinic' | 'Facility'
    /** The canvas is laid out right to left. */
    rtl: boolean
    /** Every `localStorage` call throws while the lab is open. */
    storageThrows: boolean
    /** The validity check and the search answer with units outside the user's hierarchy too. */
    ignoreScopeFilter: boolean
    /** The search answers with a 500; the user request and the validity check still work. */
    failSearch: boolean
    /** The validity check answers with a 500; the user request and the search still work. */
    failValidity: boolean
    network: LabNetwork
}

export interface LabUnit {
    id: string
    displayName: string
    path: string
    hasChildren: boolean
}

const uid = (prefix: string, index: number) =>
    `${prefix}${String(index).padStart(11 - prefix.length, '0')}`

const ROOT = 'labRoot0001'
const NEIGHBOUR = 'labNeighb01'
/** A clinic that exists, in a district the user is never assigned. */
export const OUTSIDE = 'labOutside1'
/** A uid no unit has, as if the clinic were deleted. */
export const GONE = 'labGone0001'

export const USER_IDS = {
    u1: 'labUser0001',
    u2: 'labUser0002',
} satisfies Record<LabUser, string>

export const districtId = (district: number) => uid('labDist', district)
export const flatClinicId = (index: number) => uid('labFlat', index)
export const districtClinicId = (district: number, index: number) =>
    uid(`labD${district}c`, index)

const PLACES = [
    'Ngelehun',
    'Kasana',
    'Gbo',
    'Jembe',
    'Mano',
    'Tikonko',
    'Sembehun',
    'Yamandu',
    'Kpandebu',
    'Lago',
    'Fogbo',
    'Gorahun',
    'Njala',
    'Mattru',
    'Pujehun',
    'Tiama',
    'Konta',
    'Taiama',
    'Senehun',
    'Kumrabai',
]
const B_PLACES = [
    'Baoma',
    'Bumpe',
    'Blama',
    'Bendu',
    'Bandajuma',
    'Bauya',
    'Benduma',
    'Bumban',
    'Bagbwe',
    'Bomie',
    'Borbu',
    'Bai Bureh',
    'Bafodia',
    'Banta',
    'Bassia',
    'Bethel',
    'Bumbuna',
    'Binkolo',
    'Barlie',
    'Bandasuma',
]
const TYPES = ['CHC', 'MCHP', 'CHP', 'Hospital']
const DISTRICTS = ['Kenema', 'Kailahun', 'Port Loko']
const B_DISTRICTS = ['Bombali', 'Bonthe', 'Bo']
const LONG_TAIL =
    'Community Health Centre and Maternal and Child Health Post serving the surrounding villages of the chiefdom headquarters town'

/** A new place each time and every type equally often; past 80 a number keeps the names apart within a district. */
const clinicName = (index: number, offset: number, settings: LabSettings) => {
    const places = settings.sameInitials ? B_PLACES : PLACES
    const place = places[(index + offset) % places.length]
    const block = Math.floor(index / places.length)
    const type = TYPES[(index + block) % TYPES.length]
    const round = Math.floor(index / (places.length * TYPES.length))
    return `${place} ${type}${round > 0 ? ` ${round + 1}` : ''}`
}

const named = (name: string, settings: LabSettings) =>
    settings.longNames
        ? `${name} ${LONG_TAIL}`.slice(0, 120).replace(/ $/, '.')
        : name

const clamp = (value: number, max: number) =>
    Math.max(0, Math.min(max, Math.round(value)))

/**
 * The lab's hierarchy: a country of three districts and a neighbouring one,
 * the user's own clinics in the first district, and which units the user is
 * assigned. Ids are stable per position, so remembered picks survive a change.
 */
export const generateLabData = (settings: LabSettings) => {
    const flat = clamp(settings.assignedClinics, 20)
    const districts = clamp(settings.assignedDistricts, 3)
    const perDistrict = clamp(settings.clinicsPerDistrict, 200)
    const unit = (
        id: string,
        name: string,
        parentPath: string,
        hasChildren = false
    ): LabUnit => ({
        id,
        displayName: named(name, settings),
        path: `${parentPath}/${id}`,
        hasChildren,
    })

    const root = unit(
        ROOT,
        settings.sameInitials ? 'Bintumani' : 'Sierra Leone',
        '',
        true
    )
    const units: LabUnit[] = [root]
    const flatClinics: LabUnit[] = []
    const districtUnits: LabUnit[] = []
    ;(settings.sameInitials ? B_DISTRICTS : DISTRICTS).forEach((name, at) => {
        const number = at + 1
        const own = number === 1 ? flat : 0
        const district = unit(
            districtId(number),
            name,
            root.path,
            own + perDistrict > 0
        )
        districtUnits.push(district)
        units.push(district)
        for (let index = 1; index <= own; index++) {
            const clinic = unit(
                flatClinicId(index),
                clinicName(index - 1, 13, settings),
                district.path
            )
            flatClinics.push(clinic)
            units.push(clinic)
        }
        for (let index = 1; index <= perDistrict; index++) {
            units.push(
                unit(
                    districtClinicId(number, index),
                    clinicName(index - 1, number * 7, settings),
                    district.path
                )
            )
        }
    })
    const neighbour = unit(
        NEIGHBOUR,
        settings.sameInitials ? 'Bumbali' : 'Western Area',
        root.path,
        true
    )
    units.push(
        neighbour,
        unit(
            OUTSIDE,
            settings.sameInitials
                ? 'Brookfields Hospital'
                : 'Connaught Hospital',
            neighbour.path
        )
    )

    return {
        userId: USER_IDS[settings.userId],
        assigned: [...flatClinics, ...districtUnits.slice(0, districts)],
        units,
    }
}

export type LabData = ReturnType<typeof generateLabData>

/** Whether a unit is one of the user's assigned units or below one. */
export const isInScope = (unit: LabUnit, data: LabData) =>
    data.assigned.some((assigned) => unit.path.split('/').includes(assigned.id))

/** The host's first `value` for the setting: a clinic in scope, preferring one reached through a district, one outside, or none. */
export const valueFor = (settings: LabSettings, data: LabData) => {
    if (settings.value === 'outside') return OUTSIDE
    if (settings.value === 'missing') return GONE
    if (settings.value === 'uncontrolled') return undefined
    const assignedIds = new Set(data.assigned.map(({ id }) => id))
    const throughDistrict = data.units.find(
        (unit) =>
            !unit.hasChildren &&
            !assignedIds.has(unit.id) &&
            isInScope(unit, data)
    )
    return (
        throughDistrict?.id ??
        data.assigned.filter((unit) => !unit.hasChildren).at(-1)?.id
    )
}
