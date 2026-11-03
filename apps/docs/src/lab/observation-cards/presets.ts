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
    /** What to look for once it loads. */
    note: string
    settings: LabSettings
}

const preset = (
    group: string,
    name: string,
    note: string,
    changes: Partial<LabSettings> = {}
): Preset => ({
    group,
    name,
    note,
    settings: { ...DEFAULT_SETTINGS, ...changes },
})

export const PRESETS: readonly Preset[] = [
    preset(
        'Everyday',
        'Vitals panel',
        'Haemoglobin with its legend, change and sparkline beside weight and smoking, over two enrollments with scheduled and skipped visits that must not count.',
        { enrollments: 2, scheduledSkipped: true, staleAfterDays: 180 }
    ),
    preset(
        'Everyday',
        'Crossing legend ranges',
        'Haemoglobin climbs through every band; the latest sits exactly on 11, the start of Normal.',
        { visits: 12, cards: cards({ spread: 'climbing' }) }
    ),
    preset(
        'Everyday',
        'One reading',
        'One visit: no change lines, no sparklines to draw.',
        { visits: 1 }
    ),
    preset(
        'States',
        'Never recorded',
        'Haemoglobin was never recorded at any visit; weight and smoking were.',
        { cards: cards({ neverRecorded: true }) }
    ),
    preset(
        'States',
        'Stale',
        'Last reading 400 days ago with staleAfterDays 180: greyed with the out-of-date warning.',
        { daysSinceLast: 400, staleAfterDays: 180 }
    ),
    preset(
        'States',
        'Partial access',
        'The specialist review stage, every fourth visit, is not data-readable: those visits are missing and every card says Restricted access.',
        { visits: 12, unreadableStage: true }
    ),
    preset(
        'States',
        'Unsupported value type',
        "A COORDINATE data element: the card says it can't show it.",
        { cards: cards({ element: 'location' }) }
    ),
    preset(
        'States',
        'Not in program',
        'Card 1 asks for a data element no stage captures: the setup message.',
        { cards: cards({ notInProgram: true }) }
    ),
    preset(
        'Values',
        'Coloured option set',
        'Anaemia severity codes 1–4 shown by option name on its style colour; no trend for option codes.',
        { cards: cards({ element: 'severity' }) }
    ),
    preset(
        'Values',
        'TRUE_ONLY untick',
        'Danger signs ticked at every visit except the latest, which reads "Not recorded" with the last Yes.',
        { cards: cards({ element: 'dangerSigns', trueOnlyUntick: true }) }
    ),
    preset(
        'Values',
        'Jumpy RMNCH-like',
        'Systolic pressure jumping between bands at irregular visits, like real RMNCH data. The person took up smoking halfway, so Smokes tobacco shows Yes.',
        {
            visits: 30,
            irregularVisits: true,
            cards: cards(
                { element: 'systolic', spread: 'jumpy' },
                {},
                { spread: 'climbing' }
            ),
        }
    ),
    preset(
        'Values',
        '500 readings',
        'Five hundred visits over three pages of events: a dense sparkline.',
        { visits: 500 }
    ),
    preset(
        'Values',
        'Long label and unit',
        'Labels and units far wider than the card.',
        {
            cards: cards({ longLabel: true }, { longLabel: true }),
            cardWidth: 200,
        }
    ),
    preset(
        'Values',
        'Dates and text',
        'A date in the system calendar, a free-text note and plain option names, none with a trend.',
        {
            cards: cards(
                { element: 'lmp' },
                { element: 'note' },
                { element: 'severity', optionColours: false }
            ),
        }
    ),
    preset(
        'Calendars',
        'Ethiopian calendar',
        'Recorded dates in the Ethiopian calendar.',
        { calendar: 'ethiopian' }
    ),
    preset(
        'Calendars',
        'Nepali calendar',
        'Recorded dates in the Nepali calendar.',
        { calendar: 'nepali' }
    ),
    preset(
        'Server',
        'Metadata fails',
        'The program request fails with a 500 (retried twice): every card says it could not load.',
        {
            network: {
                ...DEFAULT_SETTINGS.network,
                endpoints: { programs: { behaviour: 'fails' } },
            },
        }
    ),
    preset(
        'Server',
        'Events hang',
        'The events request never answers: every card stays loading.',
        {
            network: {
                ...DEFAULT_SETTINGS.network,
                endpoints: { 'tracker/events': { behaviour: 'hangs' } },
            },
        }
    ),
]
