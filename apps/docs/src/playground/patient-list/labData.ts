import type { LabNetwork } from '../network'

/** The Child Programme at Ngelehun CHC, as on the Sierra Leone demo database. */
export const LAB_PROGRAM = 'IpHINAT79UW'
export const LAB_ORG_UNIT = 'DiszpKrYNg8'
export const ATTRIBUTES = {
    firstName: 'w75KJ2mc4zz',
    lastName: 'zDhUuAYrxNC',
    gender: 'cejWyOfXge6',
} as const

export interface LabData {
    rows: number
    /** Changes the names and dates, so two worlds of one size differ. */
    seed: number
}

export interface LabServer {
    apiVersion: number
    /** Whether the server sorts, filters and pages as asked, or sends every record as stored. */
    query: 'honoured' | 'ignored'
    /** Whether the answer is a page the block can read. */
    response: 'valid' | 'malformed'
}

export interface LabView {
    pageSize: 10 | 15 | 25 | 50
    filters: boolean
    columnSettings: boolean
    density: boolean
    selection: boolean
    pagination: boolean
    clickable: boolean
}

export interface LabConfig {
    data: LabData
    server: LabServer
    network: LabNetwork
    view: LabView
}

type LabEnrollmentStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED'

/** One person as the server stores them: attribute values by uid, all strings. */
export interface LabPerson {
    id: string
    attributes: Record<string, string | undefined>
    createdAt: string
    enrollmentStatus: LabEnrollmentStatus
    enrolledAt: string
    occurredAt: string
}

export interface World {
    today: string
    people: LabPerson[]
}

const NAMES = [
    ['Amina', 'Bangura', 'Female'],
    ['Fatmata', 'Kamara', 'Female'],
    ['Mohamed', 'Sesay', 'Male'],
    ['Isata', 'Conteh', 'Female'],
    ['Abu', 'Koroma', 'Male'],
    ['Mariama', 'Turay', 'Female'],
    ['Ibrahim', 'Jalloh', 'Male'],
    ['Hawa', 'Kargbo', 'Female'],
    ['Sorie', 'Mansaray', 'Male'],
    ['Kadiatu', 'Bah', 'Female'],
    ['Alusine', 'Fofanah', 'Male'],
    ['Zainab', 'Kanu', 'Female'],
    ['Foday', 'Kallon', 'Male'],
] as const

// Mostly active, some completed, a few cancelled.
const ENROLLMENT_STATUSES: readonly LabEnrollmentStatus[] = [
    ...Array<LabEnrollmentStatus>(7).fill('ACTIVE'),
    'COMPLETED',
    'COMPLETED',
    'CANCELLED',
]

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
const noise = (index: number, salt: number) => {
    const x = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453
    return x - Math.floor(x)
}

/** The program's people, enrolled over the last 90 days. */
export const generateWorld = (
    { rows, seed }: LabData,
    today = isoToday()
): World => {
    const count = Math.max(0, Math.min(5000, Math.round(rows)))
    const people = Array.from({ length: count }, (_, index): LabPerson => {
        const [firstName, lastName, gender] =
            NAMES[(index + seed) % NAMES.length] ?? NAMES[0]
        const enrolled = addDays(
            today,
            -Math.floor(noise(index, seed + 1) * 90)
        )
        return {
            id: `labTe${pad(index, 6)}`,
            attributes: {
                [ATTRIBUTES.firstName]: firstName,
                [ATTRIBUTES.lastName]: lastName,
                // One in nine left empty, so `null` filters find someone.
                [ATTRIBUTES.gender]: index % 9 === 4 ? undefined : gender,
            },
            createdAt: `${enrolled}T09:${pad(index % 60)}:00.000`,
            enrollmentStatus:
                ENROLLMENT_STATUSES[(index + seed) % 10] ?? 'ACTIVE',
            enrolledAt: `${enrolled}T00:00:00.000`,
            occurredAt: `${addDays(enrolled, -2)}T00:00:00.000`,
        }
    })
    return { today, people }
}
