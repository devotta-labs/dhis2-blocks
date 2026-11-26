import type { TallyEntry, TallyLayout, TallyOptions } from '../core/types'

const SEX = {
    id: 'sex',
    label: 'Sex',
    options: [
        { id: 'female', label: 'Female' },
        { id: 'male', label: 'Male' },
    ],
} as const

export const VACCINATIONS: TallyLayout = {
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
        { id: 'opv0', label: 'OPV 0', group: 'At birth' },
        { id: 'opv1', label: 'OPV 1', group: '6 weeks' },
        { id: 'penta1', label: 'Penta 1', group: '6 weeks' },
        { id: 'measles1', label: 'Measles 1', group: '9 months' },
    ],
    closed: [
        { row: 'bcg', options: { age: 'over1' } },
        { row: 'opv0', options: { age: 'over1' } },
    ],
}

export const VITAMIN_A: TallyLayout = {
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
        { id: 'dose1', label: 'Dose 1' },
        { id: 'dose2', label: 'Dose 2' },
    ],
}

export const GIRL: TallyOptions = { age: 'under1', sex: 'female' }
export const BOY: TallyOptions = { age: 'under1', sex: 'male' }
export const OLDER_GIRL: TallyOptions = { age: 'over1', sex: 'female' }

let made = 0

/** A tap with an id of its own, each later than the last. */
export const tapOn = (row: string, options: TallyOptions, by?: string) => {
    made += 1
    const entry: TallyEntry = {
        id: `tap-${made}`,
        at: new Date(Date.UTC(2026, 0, 1, 8, 0, made)).toISOString(),
        by,
        kind: 'tap',
        row,
        options,
    }
    return entry
}

export const correctionOn = (
    row: string,
    options: TallyOptions,
    delta: number
) => {
    made += 1
    const entry: TallyEntry = {
        id: `correction-${made}`,
        at: new Date(Date.UTC(2026, 0, 1, 8, 0, made)).toISOString(),
        kind: 'correction',
        row,
        options,
        delta,
    }
    return entry
}

export const undoOf = (undone: TallyEntry) => {
    made += 1
    const entry: TallyEntry = {
        id: `undo-${made}`,
        at: new Date(Date.UTC(2026, 0, 1, 8, 0, made)).toISOString(),
        kind: 'undo',
        undoes: undone.id,
    }
    return entry
}

/** A large sheet: 30 rows by 8 columns. */
export const LARGE: TallyLayout = {
    categories: [
        {
            id: 'age',
            label: 'Age',
            options: ['a', 'b', 'c', 'd'].map((id) => ({ id, label: id })),
        },
        SEX,
    ],
    rows: Array.from({ length: 30 }, (_, at) => ({
        id: `row${at}`,
        label: `Row ${at}`,
    })),
}

export const tapsOn = (layout: TallyLayout, count: number) =>
    Array.from({ length: count }, (_, at) => {
        const row = layout.rows[at % layout.rows.length]
        const options = Object.fromEntries(
            layout.categories.map(({ id, options: choices }) => [
                id,
                choices[(at * 7) % choices.length]?.id ?? '',
            ])
        )
        return tapOn(row?.id ?? '', options)
    })
