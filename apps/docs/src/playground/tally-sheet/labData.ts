import {
    mergeTallyEntries,
    tallyColumns,
    type TallyCount,
    type TallyEntry,
    type TallyLayout,
    type TallyOptions,
} from '@/components/tally-sheet'

const SEX = {
    id: 'sex',
    label: 'Sex',
    options: [
        { id: 'female', label: 'Female' },
        { id: 'male', label: 'Male' },
    ],
}

const VITAMIN_A: TallyLayout = {
    categories: [
        {
            id: 'status',
            label: 'Status',
            options: [
                { id: 'refugee', label: 'Refugee' },
                { id: 'national', label: 'National' },
            ],
        },
    ],
    rows: [
        { id: 'postNatal', label: 'Post-natal' },
        { id: 'dose1', label: 'Dose 1' },
        { id: 'dose2', label: 'Dose 2' },
        { id: 'dose3', label: 'Dose 3' },
        { id: 'dose4', label: 'Dose 4 and above' },
    ],
}

const VACCINATIONS: TallyLayout = {
    categories: [
        {
            id: 'age',
            label: 'Age',
            options: [
                { id: 'under1', label: '0–11 months' },
                { id: 'over1', label: '12–23 months' },
            ],
        },
        SEX,
    ],
    rows: [
        { id: 'bcg', label: 'BCG', group: 'At birth' },
        { id: 'hepb0', label: 'HepB birth dose', group: 'At birth' },
        { id: 'opv0', label: 'OPV 0', group: 'At birth' },
        { id: 'opv1', label: 'OPV 1', group: '6 weeks' },
        { id: 'penta1', label: 'Penta 1', group: '6 weeks' },
        { id: 'pcv1', label: 'PCV 1', group: '6 weeks' },
        { id: 'opv2', label: 'OPV 2', group: '10 weeks' },
        { id: 'penta2', label: 'Penta 2', group: '10 weeks' },
        { id: 'opv3', label: 'OPV 3', group: '14 weeks' },
        { id: 'penta3', label: 'Penta 3', group: '14 weeks' },
        { id: 'ipv', label: 'IPV', group: '14 weeks' },
        { id: 'measles1', label: 'Measles 1', group: '9 months' },
        { id: 'measles2', label: 'Measles 2', group: '18 months' },
    ],
    closed: [
        { row: 'bcg', options: { age: 'over1' } },
        { row: 'hepb0', options: { age: 'over1' } },
        { row: 'opv0', options: { age: 'over1' } },
        { row: 'measles2', options: { age: 'under1' } },
    ],
}

const DIAGNOSES = [
    'Malaria (suspected)',
    'Malaria (confirmed)',
    'Upper respiratory infection',
    'Pneumonia',
    'Watery diarrhoea',
    'Bloody diarrhoea',
    'Measles',
    'Meningitis',
    'Acute flaccid paralysis',
    'Acute malnutrition',
    'Anaemia',
    'Skin infection',
    'Eye infection',
    'Ear infection',
    'Urinary tract infection',
    'Sexually transmitted infection',
    'Tuberculosis (suspected)',
    'Hypertension',
    'Diabetes',
    'Epilepsy',
    'Mental health condition',
    'Dental condition',
    'Musculoskeletal pain',
    'Intestinal worms',
    'Typhoid (suspected)',
    'Dog bite',
    'Snake bite',
    'Burns',
    'Injury',
    'Other',
]

const LARGE: TallyLayout = {
    categories: [
        {
            id: 'age',
            label: 'Age',
            options: [
                { id: 'under1', label: 'Under 1' },
                { id: 'under5', label: '1–4' },
                { id: 'under15', label: '5–14' },
                { id: 'over15', label: '15 and over' },
            ],
        },
        SEX,
    ],
    rows: DIAGNOSES.map((label, at) => ({ id: `diagnosis${at}`, label })),
}

export const SHEETS = {
    vitaminA: { layout: VITAMIN_A, label: 'Vitamin A doses' },
    vaccinations: { layout: VACCINATIONS, label: 'Immunisation tally' },
    large: { layout: LARGE, label: 'OPD morbidity tally' },
} as const

type SheetName = keyof typeof SHEETS

export const HOST_DELAYS = [0, 250, 1000] as const

type HostDelay = (typeof HOST_DELAYS)[number]

/** The device the lab's sheet runs on, and the one whose taps are joined in. */
export const THIS_DEVICE = 'Phone'
export const OTHER_DEVICE = 'Tablet'

/** How many taps the second device adds each time. */
export const OTHER_DEVICE_TAPS = 5

export interface LabSettings {
    sheet: SheetName
    /** Marks already on the sheet when it opens. */
    seeded: number
    /** The marks on opening are two devices' logs joined, half each. */
    joined: boolean
    rtl: boolean
    /** How long the host takes to hand the log back after `onAppend`, in milliseconds. */
    hostDelay: HostDelay
}

const SESSION_END = Date.parse('2026-01-01T12:00:00.000Z')
const SECOND = 1000
const SPREAD = 7919

/** Every cell of the sheet that takes taps, row by row. */
export const openCells = (layout: TallyLayout) => {
    const columns = tallyColumns(layout)
    return layout.rows.flatMap((row) =>
        columns
            .filter(
                (column) =>
                    !(layout.closed ?? []).some(
                        (closed) =>
                            closed.row === row.id &&
                            Object.entries(closed.options).every(
                                ([category, option]) =>
                                    column.options[category] === option
                            )
                    )
            )
            .map((column) => ({ row: row.id, options: column.options }))
    )
}

const tapAt = (
    cells: ReturnType<typeof openCells>,
    place: number,
    entry: { id: string; at: string; by: string }
) => {
    const cell = cells[(place * SPREAD) % cells.length]
    return cell === undefined
        ? []
        : [{ ...entry, kind: 'tap' as const, ...cell } satisfies TallyEntry]
}

/**
 * The log a session opens on: `seeded` taps spread over the open cells, a second apart and all before any tap made
 * in the lab. Joined, every other tap is the second device's, and the two devices' logs are joined.
 */
export const sessionLog = (settings: LabSettings) => {
    const cells = openCells(SHEETS[settings.sheet].layout)
    const count = Math.max(0, Math.round(settings.seeded))
    const taps = Array.from({ length: count }, (_, at) =>
        tapAt(cells, at, {
            id: `seed-${at}`,
            at: new Date(SESSION_END - (count - at) * SECOND).toISOString(),
            by: settings.joined && at % 2 === 1 ? OTHER_DEVICE : THIS_DEVICE,
        })
    ).flat()
    if (!settings.joined) return taps
    return mergeTallyEntries(
        taps.filter(({ by }) => by === THIS_DEVICE),
        taps.filter(({ by }) => by === OTHER_DEVICE)
    )
}

/** The second device's next taps, made from `now` on; `made` is how many it has made before. */
export const otherDeviceTaps = (
    layout: TallyLayout,
    made: number,
    now: number
) => {
    const cells = openCells(layout)
    return Array.from({ length: OTHER_DEVICE_TAPS }, (_, at) =>
        tapAt(cells, made + at, {
            id: `tablet-${made + at}`,
            at: new Date(now + at).toISOString(),
            by: OTHER_DEVICE,
        })
    ).flat()
}

const optionLabels = (layout: TallyLayout, options: TallyOptions) =>
    layout.categories
        .map(
            (category) =>
                category.options.find(({ id }) => id === options[category.id])
                    ?.label ?? '?'
        )
        .join(', ')

const rowLabel = (layout: TallyLayout, row: string) =>
    layout.rows.find(({ id }) => id === row)?.label ?? row

/** One entry as the log panel lists it. */
export const describeEntry = (layout: TallyLayout, entry: TallyEntry) => {
    const by = entry.by === undefined ? '' : ` · ${entry.by}`
    if (entry.kind === 'undo') return `undo ${entry.undoes}${by}`
    const place = `${rowLabel(layout, entry.row)} · ${optionLabels(layout, entry.options)}`
    if (entry.kind === 'tap') return `tap ${place}${by}`
    const delta = entry.delta > 0 ? `+${entry.delta}` : String(entry.delta)
    return `${entry.kind} ${delta} ${place}${by}`
}

/** One count as the log panel lists it. */
export const describeCount = (layout: TallyLayout, count: TallyCount) =>
    `${rowLabel(layout, count.row)} · ${optionLabels(layout, count.options)} = ${count.count}`
