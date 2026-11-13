import type { LabSettings } from './labData'

export const DEFAULT_SETTINGS: LabSettings = {
    required: false,
    readOnly: false,
    messages: 'none',
    hideOption: false,
    density: 'regular',
    rtl: false,
    calendar: 'gregorian',
    dateFormat: 'YYYY-MM-DD',
    filled: false,
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
    preset('Values', 'Empty'),
    preset('Values', 'Filled in', { filled: true }),
    preset('Rules', 'Required with errors', {
        required: true,
        messages: 'error',
    }),
    preset('Rules', 'Warnings', { filled: true, messages: 'warning' }),
    preset('Rules', 'Read-only', { filled: true, readOnly: true }),
    preset('Rules', 'Hidden options', { filled: true, hideOption: true }),
    preset('Look', 'Compact', { filled: true, density: 'compact' }),
    preset('Look', 'Ethiopian calendar', {
        filled: true,
        calendar: 'ethiopian',
    }),
    preset('Look', 'Right to left', { filled: true, rtl: true }),
    preset('Look', 'Nepali, day first', {
        filled: true,
        calendar: 'nepali',
        dateFormat: 'DD-MM-YYYY',
    }),
]
