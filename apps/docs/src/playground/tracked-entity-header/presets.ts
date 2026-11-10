import type { LabSettings } from './labData'

export const DEFAULT_SETTINGS: LabSettings = {
    person: 'pregnancy',
    inactive: false,
    potentialDuplicate: false,
    restricted: false,
    calendar: 'gregorian',
    arrangement: 'composed',
    width: 'wide',
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
    preset('States', 'Restricted', { restricted: true }),
    preset('States', 'Failed', {
        network: {
            delay: 50,
            endpoints: { 'tracker/trackedEntities': { behaviour: 'fails' } },
        },
    }),
    preset('States', 'Slow', { network: { delay: 2000, endpoints: {} } }),
]
