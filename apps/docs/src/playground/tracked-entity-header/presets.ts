import type { LabSettings } from './labData'

export const DEFAULT_SETTINGS: LabSettings = {
    record: 'pregnancy',
    inactive: false,
    potentialDuplicate: false,
    restricted: false,
    missing: false,
    enrollment: 'enrolled',
    calendar: 'gregorian',
    arrangement: 'composed',
    width: 'wide',
    frame: 'card',
    rtl: false,
    actions: 'one',
    lineOne: 'usual',
    relationships: 'none',
    network: { delay: 50, endpoints: {} },
}

/** Where the parts are shown: the banner, or one of two layouts of the host's own. */
export type Canvas = 'banner' | 'quick-look' | 'sidebar'

export interface Preset {
    group: string
    name: string
    settings: LabSettings
    canvas: Canvas
    /** Kept under Edge cases, closed to start, so the first look stays short. */
    folded: boolean
}

const preset = (
    group: string,
    name: string,
    changes: Partial<LabSettings> = {},
    {
        canvas = 'banner',
        folded = false,
    }: Partial<Pick<Preset, 'canvas' | 'folded'>> = {}
): Preset => ({
    group,
    name,
    settings: { ...DEFAULT_SETTINGS, ...changes },
    canvas,
    folded,
})

const edge = (
    group: string,
    name: string,
    changes: Partial<LabSettings> = {}
): Preset => preset(group, name, changes, { folded: true })

/**
 * A few examples of what the block is for, then the edge cases, folded.
 * Width, flags, access, right to left and the network are options, so no
 * example repeats one of them.
 */
export const PRESETS: readonly Preset[] = [
    preset('Start here', 'Patient banner'),
    preset('Start here', 'Child', { record: 'child' }),
    preset('Start here', 'Vaccine shipment', {
        record: 'shipment',
        actions: 'several',
    }),
    preset('Ways to compose', 'Default banner', { arrangement: 'default' }),
    preset('Ways to compose', 'Top of page', { frame: 'page' }),
    preset('Ways to compose', 'Sidebar', {}, { canvas: 'sidebar' }),
    preset('Ways to compose', 'Quick look', {}, { canvas: 'quick-look' }),
    preset('Relationships', 'Mother and baby', { relationships: 'mother' }),
    preset('Relationships', '300 linked cases', {
        record: 'adult',
        relationships: 'focus',
    }),
    edge('Values', 'Long values', { record: 'long' }),
    edge('Values', 'Nothing recorded', { record: 'empty' }),
    edge('Values', 'Broken metadata', { record: 'broken' }),
    edge('Values', 'Many details', { record: 'detailed' }),
    edge('Values', 'Many values on line one', {
        record: 'detailed',
        lineOne: 'more',
    }),
    edge('Enrollment', 'Completed', { record: 'adult' }),
    edge('Enrollment', 'Not enrolled', { record: 'adult', enrollment: 'none' }),
    edge('Enrollment', 'Enrolled again', {
        record: 'adult',
        enrollment: 'again',
    }),
    edge('Languages', 'Amharic, Ethiopian calendar', {
        record: 'amharic',
        calendar: 'ethiopian',
    }),
    edge('Languages', 'Arabic, right to left', { record: 'arabic', rtl: true }),
    edge('Linked records', 'Without access', { relationships: 'unreadable' }),
    edge('Linked records', 'Events only', { relationships: 'events' }),
    edge('Linked records', 'Raw type names', { relationships: 'raw' }),
    edge('Linked records', 'Raw type names, relabelled', {
        relationships: 'rawRelabelled',
    }),
    edge('Other', 'Several actions', { actions: 'several' }),
    edge('Other', 'Owner fails', {
        record: 'adult',
        network: {
            delay: 50,
            endpoints: { organisationUnits: { behaviour: 'fails' } },
        },
    }),
]
