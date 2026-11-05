import type { LabSettings } from './labData'

export const DEFAULT_SETTINGS: LabSettings = {
    example: 'inpatient',
    rules: true,
    refuse: false,
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
    preset('Event program', 'Inpatient ward'),
    preset('Event program', 'A row DHIS2 refuses', { refuse: true }),
    preset('Tracker program', 'One person’s visits', { example: 'person' }),
    preset('Register', 'Immunisation register', { example: 'immunisation' }),
]
