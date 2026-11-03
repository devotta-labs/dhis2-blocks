import type { LabSettings } from './labData'

export const DEFAULT_SETTINGS: LabSettings = {
    readings: 8,
    spread: 'steady',
    valueType: 'NUMBER',
    legendSet: true,
    optionSet: 'none',
    daysSinceLast: 3,
    staleAfterDays: 0,
    unreadableStage: false,
    enrollments: 1,
    scheduledSkipped: false,
    trueOnlyUntick: false,
    calendar: 'gregorian',
    longLabel: false,
    notInProgram: false,
    cardWidth: 280,
    cardsPerRow: 3,
    arrangement: 'default',
    network: { delay: 250, endpoints: {} },
}

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
        { readings: 12, spread: 'crossing' }
    ),
    preset(
        'Everyday',
        'One reading',
        'A single value: no change line, no sparkline to draw.',
        { readings: 1 }
    ),
    preset('States', 'Never recorded', 'No readings at all.', {
        readings: 0,
    }),
    preset(
        'States',
        'Stale',
        'Last reading 400 days ago with staleAfterDays 180: greyed with the out-of-date warning.',
        { daysSinceLast: 400, staleAfterDays: 180 }
    ),
    preset(
        'States',
        'Partial access',
        'A stage capturing haemoglobin is not data-readable: its visits are missing and the card says Restricted access.',
        { readings: 12, unreadableStage: true }
    ),
    preset(
        'States',
        'Unsupported value type',
        "A COORDINATE data element: the card says it can't show it.",
        { valueType: 'COORDINATE' }
    ),
    preset(
        'States',
        'Not in program',
        'The first card asks for a data element no stage captures: the setup message.',
        { notInProgram: true }
    ),
    preset(
        'Values',
        'Coloured option set',
        'Anaemia severity codes 1–4 shown by option name on its style colour; no trend for option codes.',
        { optionSet: 'coloured', legendSet: false }
    ),
    preset(
        'Values',
        'TRUE_ONLY untick',
        'Danger signs ticked at every visit except the latest, which reads "No".',
        { valueType: 'TRUE_ONLY', trueOnlyUntick: true, legendSet: false }
    ),
    preset(
        'Values',
        'Jumpy RMNCH-like',
        'Systolic pressure jumping between bands at irregular visits, like real RMNCH data. The person took up smoking halfway, so Smokes tobacco shows Yes.',
        { valueType: 'INTEGER_POSITIVE', spread: 'jumpy', readings: 30 }
    ),
    preset(
        'Values',
        '500 readings',
        'Five hundred readings over three pages of events: a dense sparkline.',
        { readings: 500 }
    ),
    preset(
        'Values',
        'Long label and unit',
        'A label and unit far wider than the card.',
        { longLabel: true, cardWidth: 200 }
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
