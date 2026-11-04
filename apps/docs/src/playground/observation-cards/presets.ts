import type { LabCard, LabSettings } from './labData'

const CARD: LabCard = {
    element: 'haemoglobin',
    spread: 'steady',
    legendSet: true,
    optionColours: true,
    trueOnlyUntick: false,
    neverRecorded: false,
    longLabel: false,
    notInProgram: false,
}

/** Haemoglobin, weight and smoking, as on an antenatal card. */
const CARDS: LabCard[] = [
    CARD,
    { ...CARD, element: 'weight' },
    { ...CARD, element: 'smoker' },
]

export const DEFAULT_SETTINGS: LabSettings = {
    visits: 8,
    irregularVisits: false,
    daysSinceLast: 3,
    staleAfterDays: 0,
    unreadableStage: false,
    enrollments: 1,
    scheduledSkipped: false,
    calendar: 'gregorian',
    cards: CARDS,
    cardWidth: 280,
    cardsPerRow: 3,
    arrangement: 'default',
    network: { delay: 250, endpoints: {} },
}

/** A card's settings over the default for its position. */
export const cardDefaults = (index: number): LabCard => CARDS[index] ?? CARD

/** The three cards, each changed from its default. */
const cards = (...changes: Array<Partial<LabCard>>): LabCard[] =>
    CARDS.map((card, index) => ({ ...card, ...changes[index] }))

export interface Preset {
    group: string
    name: string
    settings: LabSettings
}

const preset = (
    group: string,
    name: string,
    changes: Partial<LabSettings> = {}
): Preset => ({
    group,
    name,
    settings: { ...DEFAULT_SETTINGS, ...changes },
})

export const PRESETS: readonly Preset[] = [
    preset('Everyday', 'Vitals panel', {
        enrollments: 2,
        scheduledSkipped: true,
        staleAfterDays: 180,
    }),
    preset('Everyday', 'Crossing legend ranges', {
        visits: 12,
        cards: cards({ spread: 'climbing' }),
    }),
    preset('Everyday', 'Jumpy blood pressure', {
        visits: 30,
        irregularVisits: true,
        cards: cards(
            { element: 'systolic', spread: 'jumpy' },
            {},
            { spread: 'climbing' }
        ),
    }),
    preset('Values', 'Coloured option set', {
        cards: cards({ element: 'severity' }),
    }),
    preset('Values', 'Dates and text', {
        cards: cards(
            { element: 'lmp' },
            { element: 'note' },
            { element: 'severity', optionColours: false }
        ),
    }),
    preset('Values', 'Long label and unit', {
        cards: cards({ longLabel: true }, { longLabel: true }),
        cardWidth: 200,
    }),
    preset('States', 'One reading', { visits: 1 }),
    preset('States', 'Never recorded', {
        cards: cards({ neverRecorded: true }),
    }),
    preset('States', 'Stale', { daysSinceLast: 400, staleAfterDays: 180 }),
    preset('States', 'Partial access', { visits: 12, unreadableStage: true }),
]
