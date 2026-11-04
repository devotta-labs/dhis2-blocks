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

// Names say what the canvas shows. Calendar, language and time field are options, so no preset only changes one.
export const PRESETS: readonly Preset[] = [
    // First, so the lab opens on it: one program, a few visits, nothing else.
    preset('Everyday', 'A few visits', {
        programs: 1,
        events: [3, 0, 0],
        overdue: 0,
        skipped: 0,
        notes: false,
        changelog: 'none',
    }),
    preset('Everyday', 'Two programs'),
    preset('Everyday', 'One program, nothing overdue', {
        programs: 1,
        events: [6, 0, 0],
        overdue: 0,
        skipped: 0,
    }),
    preset('Everyday', 'Just enrolled', {
        programs: 1,
        events: [0, 0, 0],
        upcoming: 2,
        overdue: 0,
        skipped: 0,
        changelog: 'none',
    }),
    preset('Everyday', 'No history', { programs: 0 }),
    preset('Volume', 'Over 500 events', {
        events: [620, 80, 0],
        upcoming: 2,
        overdue: 2,
        skipped: 3,
        step: 50,
    }),
    preset('Volume', 'Over 500 changes', { changelog: 'many' }),
    preset('Failures', 'Events fail', { failing: 'events' }),
    preset('Failures', 'Changes fail', { failing: 'changes' }),
    preset('Failures', 'Program details fail', { failing: 'metadata' }),
    preset('Failures', 'Org unit names fail', { failing: 'orgUnits' }),
    preset('Failures', 'No changelog endpoint', { changelog: 'unsupported' }),
]
