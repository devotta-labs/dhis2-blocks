import type { OrgUnitSwitcherTexts } from '@/components/org-unit-switcher'
import type { LabNetwork } from '../network'

export interface LabSettings {
    /** Clinics assigned on their own (0–20); they sit in the first district. */
    assignedOrgUnits: number
    /** Districts assigned (0–3), so the user is assigned above clinic level. */
    assignedDistricts: number
    /** Clinics under each district (0–200). */
    orgUnitsPerDistrict: number
    longNames: boolean
    collapsed: boolean
    /** The host's `value`: none; a clinic inside the user's scope, held whatever the user picks; or the same clinic to start, adopting each pick. */
    value: 'uncontrolled' | 'valid' | 'follows'
    /** What the switcher calls the units: its own default words, or an app's for clinics or schools. */
    texts: 'default' | 'clinics' | 'schools'
    /** The canvas is laid out right to left. */
    rtl: boolean
    /** The search answers with a 500; the user request and the validity check still work. */
    failSearch: boolean
    /** The validity check answers with a 500; the user request and the search still work. */
    failValidity: boolean
    network: LabNetwork
}

export interface LabUnit {
    id: string
    displayName: string
    /** DHIS2's short name: the place and type, whatever the full name's length. */
    displayShortName: string
    path: string
    hasChildren: boolean
}

const uid = (prefix: string, index: number) =>
    `${prefix}${String(index).padStart(11 - prefix.length, '0')}`

const ROOT = 'labRoot0001'
export const USER_ID = 'labUser0001'

export const districtId = (district: number) => uid('labDist', district)
export const flatOrgUnitId = (index: number) => uid('labFlat', index)
export const districtOrgUnitId = (district: number, index: number) =>
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
const TYPES = ['CHC', 'MCHP', 'CHP', 'Hospital']
const DISTRICTS = ['Kenema', 'Kailahun', 'Port Loko']
const LONG_TAIL =
    'Community Health Centre and Maternal and Child Health Post serving the surrounding villages of the chiefdom headquarters town'

const orgUnitName = (index: number, offset: number) => {
    const place = PLACES[(index + offset) % PLACES.length]
    const block = Math.floor(index / PLACES.length)
    const type = TYPES[(index + block) % TYPES.length]
    const round = Math.floor(index / (PLACES.length * TYPES.length))
    return `${place} ${type}${round > 0 ? ` ${round + 1}` : ''}`
}

const named = (name: string, settings: LabSettings) =>
    settings.longNames
        ? `${name} ${LONG_TAIL}`.slice(0, 120).replace(/ $/, '.')
        : name

const clamp = (value: number, max: number) =>
    Math.max(0, Math.min(max, Math.round(value)))

/**
 * The lab's hierarchy: a country of three districts, the user's own clinics in the first district, and which units the user is
 * assigned. Ids are stable per position, so remembered picks survive a change.
 */
export const generateLabData = (settings: LabSettings) => {
    const flat = clamp(settings.assignedOrgUnits, 20)
    const districts = clamp(settings.assignedDistricts, 3)
    const perDistrict = clamp(settings.orgUnitsPerDistrict, 2000)
    const unit = (
        id: string,
        name: string,
        parentPath: string,
        hasChildren = false
    ) => ({
        id,
        displayName: named(name, settings),
        displayShortName: name,
        path: `${parentPath}/${id}`,
        hasChildren,
    })

    const root = unit(ROOT, 'Sierra Leone', '', true)
    const units: LabUnit[] = [root]
    const flatOrgUnits: LabUnit[] = []
    const districtUnits: LabUnit[] = []
    DISTRICTS.forEach((name, at) => {
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
            const orgUnit = unit(
                flatOrgUnitId(index),
                orgUnitName(index - 1, 13),
                district.path
            )
            flatOrgUnits.push(orgUnit)
            units.push(orgUnit)
        }
        for (let index = 1; index <= perDistrict; index++) {
            units.push(
                unit(
                    districtOrgUnitId(number, index),
                    orgUnitName(index - 1, number * 7),
                    district.path
                )
            )
        }
    })

    return {
        userId: USER_ID,
        assigned: [...flatOrgUnits, ...districtUnits.slice(0, districts)],
        units,
    }
}

export type LabData = ReturnType<typeof generateLabData>

/** Whether a unit is one of the user's assigned units or below one. */
export const isInScope = (unit: LabUnit, data: LabData) =>
    data.assigned.some((assigned) => unit.path.split('/').includes(assigned.id))

/** The host's first `value` for the setting: a clinic in scope, preferring one reached through a district, or none. */
export const valueFor = (settings: LabSettings, data: LabData) => {
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

/** The words an app would pass for each `texts` setting; the default passes none. */
export const LAB_TEXTS = {
    default: undefined,
    clinics: {
        label: 'Clinic',
        searchPlaceholder: 'Search clinics',
        choose: 'Choose a clinic',
        noneAssigned: 'No clinic assigned',
        loadFailed: 'Clinics could not be loaded',
        allUnits: 'All clinics',
        noResults: 'No clinics found',
        loadingMore: 'Loading more clinics',
        moreFailed: 'More clinics could not be loaded. Try again',
        changed: (name) => `Clinic changed to ${name}`,
    },
    schools: {
        label: 'School',
        searchPlaceholder: 'Search schools',
        choose: 'Choose a school',
        noneAssigned: 'No school assigned',
        loadFailed: 'Schools could not be loaded',
        allUnits: 'All schools',
        noResults: 'No schools found',
        loadingMore: 'Loading more schools',
        moreFailed: 'More schools could not be loaded. Try again',
        changed: (name) => `School changed to ${name}`,
    },
} satisfies Record<
    LabSettings['texts'],
    Partial<OrgUnitSwitcherTexts> | undefined
>
