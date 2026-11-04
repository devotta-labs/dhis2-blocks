import type { LabSettings } from './labData'

export const DEFAULT_SETTINGS: LabSettings = {
    programs: 2,
    events: [8, 5, 3],
    upcoming: 1,
    overdue: 1,
    skipped: 1,
    notes: true,
    changelog: 'some',
    failing: 'none',
    timeField: 'occurredAt',
    calendar: 'gregorian',
    locale: 'en',
    step: 20,
    network: { delay: 250, endpoints: {} },
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
    preset('Everyday', 'Case history'),
    preset('Everyday', 'Three programs', { programs: 3, events: [12, 8, 3] }),
    preset('Everyday', 'One program', {
        programs: 1,
        events: [6, 0, 0],
        overdue: 0,
        skipped: 0,
    }),
    preset('Volume', 'Many events', {
        events: [620, 80, 0],
        upcoming: 2,
        overdue: 2,
        skipped: 3,
        step: 50,
    }),
    preset('Volume', 'Many changes', { changelog: 'many' }),
    preset('Failures', 'Changes fail', { failing: 'changes' }),
    preset('Failures', 'Program details fail', { failing: 'metadata' }),
    preset('Failures', 'Org unit names fail', { failing: 'orgUnits' }),
    preset('Failures', 'Events fail', { failing: 'events' }),
    preset('Failures', 'No changelog (404)', { changelog: 'unsupported' }),
    preset('States', 'Empty history', { programs: 0 }),
    preset('States', 'Nothing recorded yet', {
        programs: 1,
        events: [0, 0, 0],
        upcoming: 2,
        overdue: 0,
        skipped: 0,
        changelog: 'none',
    }),
    preset('Display', 'Ethiopian calendar', { calendar: 'ethiopian' }),
    preset('Display', 'Right to left', { locale: 'ar' }),
    preset('Display', 'By due date', { timeField: 'scheduledAt' }),
]
