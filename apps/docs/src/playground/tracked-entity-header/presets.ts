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
    rtl: false,
    actions: 'one',
    lineOne: 'usual',
    relationships: 'none',
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
    preset('People', 'Child', { record: 'child' }),
    preset('People', 'Adult, completed', { record: 'adult' }),
    preset('Flags', 'Inactive', { inactive: true }),
    preset('Flags', 'Possible duplicate', { potentialDuplicate: true }),
    preset('Flags', 'Every flag', {
        inactive: true,
        potentialDuplicate: true,
    }),
    preset('Values', 'Long values', { record: 'long' }),
    preset('Values', 'Long values, narrow', {
        record: 'long',
        width: 'narrow',
    }),
    preset('Values', 'Nothing recorded', { record: 'empty' }),
    preset('Values', 'Broken metadata', { record: 'broken' }),
    preset('Enrollment', 'Not enrolled', {
        record: 'adult',
        enrollment: 'none',
    }),
    preset('Enrollment', 'Enrolled again', {
        record: 'adult',
        enrollment: 'again',
    }),
    preset('Languages', 'Amharic, Ethiopian calendar', {
        record: 'amharic',
        calendar: 'ethiopian',
    }),
    preset('Languages', 'Arabic, right to left', {
        record: 'arabic',
        rtl: true,
    }),
    preset('Languages', 'Arabic, right to left, narrow', {
        record: 'arabic',
        rtl: true,
        width: 'narrow',
    }),
    preset('Layout', 'Several actions', { actions: 'several' }),
    preset('Layout', 'Several actions, narrow', {
        actions: 'several',
        width: 'narrow',
    }),
    preset('Layout', 'Many values on line one', {
        record: 'detailed',
        lineOne: 'more',
    }),
    preset('Layout', 'Many details', { record: 'detailed' }),
    preset('Layout', 'No details', { record: 'child' }),
    preset('Not a person', 'Vaccine shipment', {
        record: 'shipment',
        actions: 'several',
    }),
    preset('Relationships', 'Mother and baby', { relationships: 'mother' }),
    preset('Relationships', 'Focus with 300 cases', {
        record: 'adult',
        relationships: 'focus',
    }),
    preset('Relationships', 'Linked record without access', {
        relationships: 'unreadable',
    }),
    preset('Relationships', 'Linked events only', { relationships: 'events' }),
    preset('Relationships', 'Raw type names', { relationships: 'raw' }),
    preset('Relationships', 'Raw type names, relabelled', {
        relationships: 'rawRelabelled',
    }),
    preset('States', 'Restricted', { restricted: true }),
    preset('States', 'Not found', { missing: true }),
    preset('States', 'Failed', {
        network: {
            delay: 50,
            endpoints: { 'tracker/trackedEntities': { behaviour: 'fails' } },
        },
    }),
    preset('States', 'Owner fails', {
        record: 'adult',
        network: {
            delay: 50,
            endpoints: { organisationUnits: { behaviour: 'fails' } },
        },
    }),
    preset('States', 'Slow', { network: { delay: 2000, endpoints: {} } }),
]
