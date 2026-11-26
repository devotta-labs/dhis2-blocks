import type { LabSettings } from './labData'

export const DEFAULT_SETTINGS: LabSettings = {
    sheet: 'vitaminA',
    seeded: 0,
    joined: false,
    rtl: false,
    hostDelay: 0,
}

export interface Preset {
    group: string
    name: string
    settings: LabSettings
    folded?: boolean
}

const preset = (
    group: string,
    name: string,
    changes: Partial<LabSettings> = {},
    folded = false
) => ({
    group,
    name,
    settings: { ...DEFAULT_SETTINGS, ...changes },
    folded,
})

export const PRESETS: readonly Preset[] = [
    preset('Sheets', 'Vitamin A'),
    preset('Sheets', 'Vaccinations', { sheet: 'vaccinations', seeded: 40 }),
    preset('Sheets', 'Large sheet', { sheet: 'large', seeded: 2000 }),
    preset('Sessions', 'Joined with a tablet', {
        sheet: 'vaccinations',
        seeded: 60,
        joined: true,
    }),
    preset('Sessions', 'Slow host', {
        sheet: 'vaccinations',
        seeded: 40,
        hostDelay: 1000,
    }),
    preset('Sessions', 'Right to left', {
        sheet: 'vaccinations',
        seeded: 40,
        rtl: true,
    }),
    preset(
        'Long logs',
        '100,000 marks',
        { sheet: 'large', seeded: 100_000 },
        true
    ),
    preset(
        'Long logs',
        '100,000 marks, slow host',
        { sheet: 'large', seeded: 100_000, hostDelay: 250 },
        true
    ),
]
