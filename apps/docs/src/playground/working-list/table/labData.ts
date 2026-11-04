import type {
    WorkingListDataQualityMode,
    WorkingListPageSize,
} from '@/components/working-list'
import type { LabNetwork } from '../../network'

export const LAB_PROGRAM = 'labProgram1'
export const LAB_STAGE = 'labStage001'
export const LAB_ORG_UNIT = 'labOrgUnit1'
export const ATTRIBUTES = {
    firstName: 'labFirstNam',
    lastName: 'labLastName',
    nationalId: 'labNationId',
    sex: 'labSex00001',
    birthDate: 'labBirthDat',
    phone: 'labPhoneNum',
    village: 'labVillage1',
    consent: 'labConsent1',
}
export const DATA_ELEMENTS = {
    weight: 'labWeight01',
    visitType: 'labVisitTyp',
    referred: 'labReferred',
}

export interface LabData {
    /** Tracked entities by enrollment, or one follow-up visit per person. */
    mode: 'trackedEntity' | 'event'
    records: number
    names: 'everyday' | 'long' | 'unicode' | 'blank'
    /** Share of optional values left out (%). */
    emptyValues: number
    /** Share of records with one value the block cannot read (%). */
    badValues: number
}

export interface LabServer {
    apiVersion: number
    /** Whether the server sorts and filters as asked, or sends every record as stored. */
    query: 'honoured' | 'ignored'
    savedViews: 'none' | 'some' | 'many'
    /** Whether the user may change the seeded saved views. */
    viewAccess: 'owner' | 'readOnly'
}

export interface LabView {
    viewSwitcher: boolean
    toolbar: boolean
    columnSelector: boolean
    filterControls: boolean
    actions: boolean
    dataQuality: WorkingListDataQualityMode
    clickable: boolean
    pageSize: WorkingListPageSize
}

export interface LabConfig {
    data: LabData
    server: LabServer
    network: LabNetwork
    view: LabView
}

/** One person as the server stores them: values by attribute or data element id, all strings. */
export interface LabPerson {
    id: string
    attributes: Record<string, string | undefined>
    createdAt: string
    enrollmentStatus: 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
    enrolledAt: string
    occurredAt: string
    followUp: boolean
    visit: {
        id: string
        status: 'COMPLETED' | 'SCHEDULE' | 'ACTIVE'
        occurredAt?: string
        scheduledAt: string
        dataValues: Record<string, string | undefined>
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
    ['Sorie', 'Mansaray'],
    ['Kadiatu', 'Bah'],
    ['Alusine', 'Fofanah'],
    ['Zainab', 'Kanu'],
]

// Matches EVERYDAY, so a sex filter reads sensibly.
const SEXES = ['F', 'F', 'M', 'F', 'M', 'F', 'M', 'F', 'M', 'F', 'M', 'F']

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

export const VILLAGES = [
    ['BO', 'Bo'],
    ['KEN', 'Kenema'],
    ['MAK', 'Makeni'],
    ['KON', 'Kono'],
    ['FRE', 'Freetown'],
    ['POR', 'Port Loko'],
] as const

export const VISIT_TYPES = [
    ['FIRST', 'First visit'],
    ['ROUTINE', 'Routine check'],
    ['URGENT', 'Urgent'],
] as const

const ENROLLMENT_STATUSES = [
    ...Array<'ACTIVE'>(7).fill('ACTIVE'),
    'COMPLETED',
    'COMPLETED',
    'CANCELLED',
] as const

const pad = (value: number, length = 2) => String(value).padStart(length, '0')

/** ISO date `offset` days from `today`. */
const addDays = (today: string, offset: number) => {
    const date = new Date(`${today}T12:00:00Z`)
    date.setUTCDate(date.getUTCDate() + offset)
    return date.toISOString().slice(0, 10)
}

const isoToday = () => {
    const now = new Date()
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** Deterministic noise, so a preset always shows the same rows. */
const noise = (index: number, salt = 0) => {
    const x = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453
    return x - Math.floor(x)
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

/** One value per record the block cannot read, by field, as a real server might hold it. */
const BAD_VALUES: ReadonlyArray<readonly [string, string]> = [
    [ATTRIBUTES.birthDate, '31/12/1990'],
    [ATTRIBUTES.sex, 'X'],
    [ATTRIBUTES.consent, 'maybe'],
    [DATA_ELEMENTS.weight, 'heavy'],
    [DATA_ELEMENTS.visitType, 'RETIRED'],
]

/** The made-up program's people: enrolled over the past two years, each with one visit around today. */
export const generateWorld = (data: LabData, today = isoToday()): World => {
    const count = Math.max(0, Math.min(5000, Math.round(data.records)))
    const people = Array.from({ length: count }, (_, index): LabPerson => {
        const [firstName, lastName] = nameFor(data, index) ?? []
        const optional = (salt: number, value: string) =>
            noise(index, salt) * 100 < data.emptyValues ? undefined : value
        const enrolled = addDays(today, -Math.floor(noise(index, 1) * 730))
        const visitDay = addDays(
            today,
            Math.round((noise(index, 2) - 0.6) * 90)
        )
        const done = visitDay <= today && index % 4 !== 0
        const village = VILLAGES[index % VILLAGES.length]?.[0] ?? 'BO'
        const attributes: LabPerson['attributes'] = {
            [ATTRIBUTES.firstName]: firstName,
            [ATTRIBUTES.lastName]: lastName,
            [ATTRIBUTES.nationalId]: `SL-${pad(100000 + index, 6)}`,
            [ATTRIBUTES.sex]: SEXES[index % SEXES.length],
            [ATTRIBUTES.birthDate]: optional(
                3,
                addDays('2010-01-01', -Math.floor(noise(index, 4) * 25000))
            ),
            [ATTRIBUTES.phone]: optional(
                5,
                `+232 7${index % 10} ${pad(Math.floor(noise(index, 6) * 1000), 3)} ${pad(index % 1000, 3)}`
            ),
            [ATTRIBUTES.village]: optional(7, village),
            [ATTRIBUTES.consent]: optional(
                8,
                noise(index, 9) < 0.8 ? 'true' : 'false'
            ),
        }
        const dataValues: LabPerson['visit']['dataValues'] = done
            ? {
                  [DATA_ELEMENTS.weight]: optional(
                      10,
                      String(Math.round((45 + noise(index, 11) * 50) * 10) / 10)
                  ),
                  [DATA_ELEMENTS.visitType]: optional(
                      12,
                      VISIT_TYPES[index % VISIT_TYPES.length]?.[0] ?? 'ROUTINE'
                  ),
                  [DATA_ELEMENTS.referred]:
                      index % 5 === 0 ? 'true' : undefined,
              }
            : {}
        if (noise(index, 13) * 100 < data.badValues) {
            const [field, value] = BAD_VALUES[index % BAD_VALUES.length] ?? []
            if (field && field in attributes) attributes[field] = value
            else if (field && done) dataValues[field] = value
        }
        const id = `labTe${pad(index, 6)}`
        return {
            id,
            attributes,
            createdAt: `${enrolled}T09:${pad(index % 60)}:00.000`,
            // Mostly active, some completed, a few cancelled.
            enrollmentStatus: ENROLLMENT_STATUSES[index % 10] ?? 'ACTIVE',
            enrolledAt: timestamp(enrolled),
            occurredAt: timestamp(addDays(enrolled, -2)),
            followUp: index % 6 === 0,
            visit: {
                id: `labEv${pad(index, 6)}`,
                // One past visit in four was never done, so it is overdue.
                status: done ? 'COMPLETED' : 'SCHEDULE',
                occurredAt: done ? timestamp(visitDay) : undefined,
                scheduledAt: timestamp(visitDay),
                dataValues,
            },
        }
    })
    return { today, people }
}
