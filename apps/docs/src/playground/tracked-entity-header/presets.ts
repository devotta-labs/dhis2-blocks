import type { LabSettings } from './labData'

export const DEFAULT_SETTINGS: LabSettings = {
    person: 'pregnancy',
    inactive: false,
    potentialDuplicate: false,
    restricted: false,
    enrollment: 'enrolled',
    calendar: 'gregorian',
    arrangement: 'composed',
    width: 'wide',
    rtl: false,
    network: { delay: 50, endpoints: {} },
}

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
    preset('People', 'Pregnancy'),
    preset('People', 'Child', { person: 'child' }),
    preset('People', 'Adult, completed', { person: 'adult' }),
    preset('Flags', 'Inactive', { inactive: true }),
    preset('Flags', 'Possible duplicate', { potentialDuplicate: true }),
    preset('Flags', 'Every flag', {
        inactive: true,
        potentialDuplicate: true,
    }),
    preset('Values', 'Long values', { person: 'long' }),
    preset('Values', 'Long values, narrow', {
        person: 'long',
        width: 'narrow',
    }),
    preset('Values', 'Nothing recorded', { person: 'empty' }),
    preset('Values', 'Broken metadata', { person: 'broken' }),
    preset('Enrollment', 'Not enrolled', {
        person: 'adult',
        enrollment: 'none',
    }),
    preset('Enrollment', 'Enrolled again', {
        person: 'adult',
        enrollment: 'again',
    }),
    preset('Languages', 'Amharic, Ethiopian calendar', {
        person: 'amharic',
        calendar: 'ethiopian',
    }),
    preset('Languages', 'Arabic, right to left', {
        person: 'arabic',
        rtl: true,
    }),
    preset('Languages', 'Arabic, right to left, narrow', {
        person: 'arabic',
        rtl: true,
        width: 'narrow',
    }),
    preset('States', 'Restricted', { restricted: true }),
    preset('States', 'Failed', {
        network: {
            delay: 50,
            endpoints: { 'tracker/trackedEntities': { behaviour: 'fails' } },
        },
    }),
    preset('States', 'Owner fails', {
        person: 'adult',
        network: {
            delay: 50,
            endpoints: { organisationUnits: { behaviour: 'fails' } },
        },
    }),
    preset('States', 'Slow', { network: { delay: 2000, endpoints: {} } }),
]
