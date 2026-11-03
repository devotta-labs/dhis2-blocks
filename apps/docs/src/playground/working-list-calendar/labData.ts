import type {
    WorkingListCalendarDateField,
    WorkingListCalendarProps,
    WorkingListCalendarTone,
    WorkingListCalendarWeekday,
} from '@/components/working-list-calendar'
import type { LabNetwork } from '../network'

export const LAB_PROGRAM = 'labProgram1'
export const LAB_STAGE = 'labStage001'
export const LAB_ORG_UNIT = 'labOrgUnit1'
export const ATTRIBUTES = {
    firstName: 'labFirstNam',
    lastName: 'labLastName',
    nationalId: 'labNationId',
    location: 'labLocatio1',
    sex: 'labSex00001',
}
export const WEIGHT = 'labWeight01'

type LabCalendar =
    | 'gregorian'
    | 'ethiopian'
    | 'nepali'
    | 'coptic'
    | 'islamic'
    | 'persian'
    | 'thai'
    | 'iso8601'

export interface LabData {
    /** Tracked entities by enrollment, or one follow-up visit per person. */
    mode: 'trackedEntity' | 'event'
    records: number
    /** Records fall within this many days either side of today. */
    spanDays: number
    spread: 'even' | 'clustered' | 'oneDay' | 'weekdays' | 'future' | 'past'
    names: 'everyday' | 'long' | 'unicode' | 'blank' | 'unnamed'
    /** Share of records with no date on the field (%). */
    missingDates: number
    /** Share of records whose date the server sends malformed (%). */
    badDates: number
    /** Share of records sent twice (%). */
    duplicates: number
    /** How many locations people live in, for the status-by-location rule. */
    locations: number
}

export interface LabServer {
    records: 'ok' | 'ignoresWindow'
    calendar: LabCalendar
    dateFormat: 'YYYY-MM-DD' | 'DD-MM-YYYY'
    timeZone: string
    apiVersion: number
    /** A saved view whose date filter limits the calendar. */
    savedFilter: 'none' | 'thisMonth' | 'last30' | 'next90' | 'fixedPast'
    /** A saved view that reorders the list's columns. */
    columns: 'program' | 'optionFirst' | 'locationFirst' | 'idFirst'
}

export interface LabView {
    dateField: WorkingListCalendarDateField | 'default'
    limit: number
    clickable: boolean
    controlledDay: boolean
    layout: 'calendar' | 'table' | 'both' | 'toggle'
    navigation: boolean
    grid: boolean
    dayRecords: boolean
    toolbar: boolean
    readout: boolean
    /** What the lab passes as recordLabel; `default` passes nothing. */
    recordLabel: 'default' | 'fields' | 'blank' | 'rowId'
    /** Fields `recordLabel: 'fields'` joins, in order; '' leaves a slot out. */
    labelFields: [string, string, string]
    /** What days show on mount; the toggle part can change it. */
    display: 'counts' | 'records'
    displayToggle: boolean
    /** Names per day in the names display. */
    perDay: number
    /** What fills each day under its number. */
    cell: 'records' | 'plainCount' | 'none'
    weekend: 'none' | 'satSun' | 'friSat' | 'sun'
    weekendColumns: 'show' | 'narrow' | 'hide'
    /** What the lab passes as recordStatus; `default` passes nothing. */
    recordStatus: 'default' | 'none' | 'location'
}

export interface LabConfig {
    data: LabData
    server: LabServer
    network: LabNetwork
    view: LabView
}

export interface LabPerson {
    id: string
    firstName?: string
    lastName?: string
    nationalId: string
    location: string
    sex: 'F' | 'M'
    enrollmentStatus: 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
    /** Server-format timestamps; `undefined` when the record has none. */
    enrolledAt?: string
    occurredAt?: string
    visit: {
        id: string
        status: 'COMPLETED' | 'SCHEDULE' | 'ACTIVE'
        occurredAt?: string
        scheduledAt?: string
    }
}

export interface World {
    today: string
    people: LabPerson[]
}

const EVERYDAY = [
    ['Amina', 'Bangura'],
    ['Fatmata', 'Kamara'],
    ['Mohamed', 'Sesay'],
    ['Isata', 'Conteh'],
    ['Abu', 'Koroma'],
    ['Mariama', 'Turay'],
    ['Ibrahim', 'Jalloh'],
    ['Hawa', 'Kargbo'],
]

// Matches EVERYDAY, so the option-set presets read sensibly.
const SEXES = ['F', 'F', 'M', 'F', 'M', 'F', 'M', 'F'] as const

const ENROLLMENT_STATUSES = [
    ...Array<'ACTIVE'>(7).fill('ACTIVE'),
    'COMPLETED',
    'COMPLETED',
    'CANCELLED',
] as const

const LONG = [
    [
        'Maria Fernanda Guadalupe Concepción',
        'de los Santos Rodríguez-Villanueva y Montenegro',
    ],
    ['Oluwaseyifunmilayo Adebisi', 'Adeyemi-Ogunleye-Babatunde'],
    [
        'Wolfeschlegelsteinhausenbergerdorff',
        'Supercalifragilisticexpialidocious',
    ],
]

const UNICODE = [
    ['محمد', 'عبد الله'],
    ['አበበ', 'በቀለ'],
    ['राम', 'बहादुर'],
    ['明', '王'],
    ['Zoë', 'Ñúñez'],
    ['😀 Emoji', '🌍 Person'],
    ['Ångström', 'Øvergård'],
    ['Z̤͔ͧ̑a̛͈lgo', 'Text'],
]

const pad = (value: number, length = 2) => String(value).padStart(length, '0')

/** ISO date `offset` days from `today`. */
export const addDays = (today: string, offset: number) => {
    const date = new Date(`${today}T12:00:00Z`)
    date.setUTCDate(date.getUTCDate() + offset)
    return date.toISOString().slice(0, 10)
}

const isoToday = () => {
    const now = new Date()
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** Deterministic noise, so a preset always shows the same calendar. */
const noise = (index: number, salt = 0) => {
    const x = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453
    return x - Math.floor(x)
}

const offsetFor = (data: LabData, index: number, today: string) => {
    const span = Math.max(0, data.spanDays)
    const width = span * 2 + 1
    switch (data.spread) {
        case 'oneDay':
            return 3
        case 'future':
            return Math.floor(noise(index) * (span + 1))
        case 'past':
            return -Math.floor(noise(index) * (span + 1))
        case 'clustered': {
            const hotspots = [-span + 2, -3, 0, 4, span - 5]
            const centre = hotspots[index % hotspots.length] ?? 0
            return centre + Math.round((noise(index) - 0.5) * 3)
        }
        case 'weekdays': {
            const offset = Math.floor(noise(index) * width) - span
            const day = new Date(
                `${addDays(today, offset)}T12:00:00Z`
            ).getUTCDay()
            if (day === 0) return offset + 1
            if (day === 6) return offset + 2
            return offset
        }
        default:
            return data.records <= 1
                ? 0
                : Math.round(-span + (index * (width - 1)) / (data.records - 1))
    }
}

const nameFor = (data: LabData, index: number) => {
    switch (data.names) {
        case 'long':
            return LONG[index % LONG.length]
        case 'unicode':
            return UNICODE[index % UNICODE.length]
        case 'blank':
            return index % 2 === 0 ? ['', ''] : ['   ', undefined]
        default:
            return EVERYDAY[index % EVERYDAY.length]
    }
}

const timestamp = (date: string) => `${date}T00:00:00.000`

const BAD_DATES = ['not-a-date', '2026-02-30T00:00:00.000', '31/12/2026', '']

/** The made-up program's people, dated around today. */
export const generateWorld = (data: LabData, today = isoToday()): World => {
    const count = Math.max(0, Math.min(5000, Math.round(data.records)))
    const people = Array.from({ length: count }, (_, index): LabPerson => {
        const date = addDays(today, offsetFor(data, index, today))
        const roll = noise(index, 7) * 100
        let stamp: string | undefined = timestamp(date)
        if (roll < data.missingDates) {
            stamp = undefined
        } else if (roll < data.missingDates + data.badDates) {
            stamp = BAD_DATES[index % BAD_DATES.length]
        }
        const [firstName, lastName] = nameFor(data, index) ?? []
        const future = date > today
        const id = `labTe${pad(index, 6)}`
        return {
            id,
            firstName,
            lastName,
            nationalId: `SL-${pad(100000 + index, 6)}`,
            location:
                LOCATIONS[
                    index %
                        Math.max(1, Math.min(LOCATIONS.length, data.locations))
                ] ?? 'Bo',
            sex: SEXES[index % SEXES.length] ?? 'F',
            enrolledAt: stamp,
            // The incident date sits two days before enrollment, or is as broken as it.
            occurredAt:
                stamp === timestamp(date)
                    ? timestamp(addDays(date, -2))
                    : stamp,
            // Mostly active, some completed, a few cancelled.
            enrollmentStatus: ENROLLMENT_STATUSES[index % 10] ?? 'ACTIVE',
            visit: {
                id: `labEv${pad(index, 6)}`,
                // One past visit in four was never done, so it is overdue.
                status: future || index % 4 === 0 ? 'SCHEDULE' : 'COMPLETED',
                occurredAt: future || index % 4 === 0 ? undefined : stamp,
                scheduledAt: stamp,
            },
        }
    })
    const duplicates = people.filter(
        (_, index) => noise(index, 3) * 100 < data.duplicates
    )
    return { today, people: [...people, ...duplicates] }
}

/** The recordLabel the lab passes for its label setting. */
export const recordLabelFor = (
    view: LabView
): WorkingListCalendarProps['recordLabel'] => {
    switch (view.recordLabel) {
        case 'fields':
            return (_row, cellText) =>
                view.labelFields
                    .filter(Boolean)
                    .map((fieldId) => cellText(fieldId))
                    .filter(Boolean)
                    .join(' · ')
        case 'blank':
            return () => ''
        case 'rowId':
            return (row) => row.id
        default:
            return undefined
    }
}

const WEEKENDS = {
    none: [],
    satSun: [6, 7],
    friSat: [5, 6],
    sun: [7],
} satisfies Record<LabView['weekend'], WorkingListCalendarWeekday[]>

export const weekendFor = (view: LabView) => WEEKENDS[view.weekend]

const LOCATIONS = [
    'Bo',
    'Kenema',
    'Makeni',
    'Kono',
    'Freetown',
    'Port Loko',
    'Kailahun',
    'Pujehun',
    'Bonthe',
    'Kambia',
    'Moyamba',
    'Tonkolili',
]

const TONES: readonly WorkingListCalendarTone[] = [
    'info',
    'positive',
    'warning',
    'critical',
    'neutral',
]

/** The recordStatus the lab passes for its status setting. */
export const recordStatusFor = (
    view: LabView
): WorkingListCalendarProps['recordStatus'] => {
    switch (view.recordStatus) {
        case 'none':
            return () => undefined
        case 'location':
            return (_row, cellText) => {
                const location = cellText(ATTRIBUTES.location)
                // Tones repeat after five locations, as they would in an app.
                const tone =
                    TONES[
                        Math.max(0, LOCATIONS.indexOf(location)) % TONES.length
                    ] ?? 'neutral'
                return { id: location, label: location, tone }
            }
        default:
            return undefined
    }
}
