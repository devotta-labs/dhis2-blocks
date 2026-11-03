import type { LabNetwork } from '../network'
import {
    ATTRIBUTES,
    type LabConfig,
    type LabData,
    type LabServer,
    type LabView,
} from './labData'

export const DEFAULT_CONFIG: LabConfig = {
    data: {
        mode: 'trackedEntity',
        records: 60,
        spanDays: 45,
        spread: 'even',
        names: 'everyday',
        missingDates: 0,
        badDates: 0,
        duplicates: 0,
        locations: 4,
    },
    server: {
        records: 'ok',
        calendar: 'gregorian',
        dateFormat: 'YYYY-MM-DD',
        timeZone: 'Africa/Freetown',
        apiVersion: 42,
        savedFilter: 'none',
        columns: 'program',
    },
    network: { delay: 250, endpoints: {} },
    view: {
        dateField: 'default',
        limit: 1000,
        clickable: true,
        controlledDay: false,
        layout: 'calendar',
        navigation: true,
        grid: true,
        dayRecords: true,
        toolbar: true,
        readout: true,
        recordLabel: 'default',
        display: 'counts',
        displayToggle: true,
        perDay: 3,
        cell: 'records',
        weekend: 'none',
        weekendColumns: 'show',
        recordStatus: 'default',
        labelFields: [
            ATTRIBUTES.nationalId,
            ATTRIBUTES.firstName,
            ATTRIBUTES.lastName,
        ],
    },
}

export interface Preset {
    group: string
    name: string
    config: LabConfig
}

const preset = (
    group: string,
    name: string,
    changes: {
        data?: Partial<LabData>
        server?: Partial<LabServer>
        network?: Partial<LabNetwork>
        view?: Partial<LabView>
    } = {}
): Preset => ({
    group,
    name,
    config: {
        data: { ...DEFAULT_CONFIG.data, ...changes.data },
        server: { ...DEFAULT_CONFIG.server, ...changes.server },
        network: { ...DEFAULT_CONFIG.network, ...changes.network },
        view: { ...DEFAULT_CONFIG.view, ...changes.view },
    },
})

const events = { mode: 'event' } as const

const records = (endpoint: LabNetwork['endpoints'][string]) => ({
    'tracker/trackedEntities': endpoint,
    'tracker/events': endpoint,
})

export const PRESETS: readonly Preset[] = [
    preset('Everyday', 'Clinic enrollments'),
    preset('Everyday', 'Upcoming appointments', {
        data: { ...events, records: 120, spread: 'future', spanDays: 75 },
        view: { dateField: 'eventScheduledAt' },
    }),
    preset('Everyday', 'Visits done', {
        data: { ...events, records: 90, spread: 'past', spanDays: 75 },
        view: { dateField: 'eventOccurredAt' },
    }),
    preset('Everyday', 'Incident dates', {
        view: { dateField: 'enrollmentOccurredAt' },
    }),
    preset('Everyday', 'Table and calendar side by side', {
        view: { layout: 'both' },
    }),
    preset('Everyday', 'Table / calendar toggle', {
        view: { layout: 'toggle' },
    }),
    preset('Design', 'Counts by status', {
        data: { records: 300, spanDays: 20 },
    }),
    preset('Design', 'Names', {
        data: { records: 300, spanDays: 20 },
        view: { display: 'records' },
    }),
    preset('Design', 'Names, six per day', {
        data: { records: 300, spanDays: 20 },
        view: { display: 'records', perDay: 6 },
    }),
    preset('Design', 'Overdue appointments', {
        data: { ...events, records: 200, spanDays: 30 },
        view: { dateField: 'eventScheduledAt' },
    }),
    preset('Design', 'Narrow Saturday and Sunday', {
        data: { records: 300, spanDays: 20 },
        view: { weekend: 'satSun', weekendColumns: 'narrow' },
    }),
    preset('Design', 'Hide a Friday and Saturday weekend', {
        data: { records: 300, spanDays: 20 },
        view: { weekend: 'friSat', weekendColumns: 'hide' },
    }),
    preset('Design', 'Status by location', {
        data: { records: 300, spanDays: 20 },
        view: { recordStatus: 'location' },
    }),
    preset('Design', 'Status by location, ten locations', {
        data: { records: 300, spanDays: 20, locations: 10 },
        view: { recordStatus: 'location' },
    }),
    preset('Design', 'Just a count (own cell part)', {
        data: { records: 300, spanDays: 20 },
        view: { cell: 'plainCount' },
    }),
    preset('Design', 'No status', {
        data: { records: 300, spanDays: 20 },
        view: { recordStatus: 'none' },
    }),
    preset('Density', 'Empty', {
        data: { records: 0 },
    }),
    preset('Density', 'One record', {
        data: { records: 1 },
    }),
    preset('Density', 'Pile-up on one day', {
        data: { records: 80, spread: 'oneDay' },
    }),
    preset('Density', 'Every day busy', {
        data: { records: 400, spanDays: 20 },
    }),
    preset('Density', 'Over the limit', {
        data: { records: 300, spanDays: 10 },
        view: { limit: 100 },
    }),
    preset('Density', 'Clustered weeks', {
        data: { records: 150, spread: 'clustered' },
    }),
    preset('Density', 'Weekdays only', {
        data: { records: 120, spread: 'weekdays' },
    }),
    preset('Density', 'Sparse, far away', {
        data: { records: 40, spanDays: 400 },
    }),
    preset('Names', 'Long names', {
        data: { names: 'long' },
    }),
    preset('Names', 'Unicode and right-to-left', {
        data: { names: 'unicode' },
    }),
    preset('Names', 'Blank names', { data: { names: 'blank' } }),
    preset('Names', 'No name columns', { data: { names: 'unnamed' } }),
    preset('Names', 'Option set first', { server: { columns: 'optionFirst' } }),
    preset('Names', 'Location first', { server: { columns: 'locationFirst' } }),
    preset('Names', 'ID first', { server: { columns: 'idFirst' } }),
    preset('Names', 'Custom recordLabel', { view: { recordLabel: 'fields' } }),
    preset('Names', 'recordLabel returns nothing', {
        view: { recordLabel: 'blank' },
    }),
    preset('Bad data', 'Missing dates', { data: { missingDates: 33 } }),
    preset('Bad data', 'Malformed dates', { data: { badDates: 10 } }),
    preset('Bad data', 'Duplicate records', { data: { duplicates: 20 } }),
    preset('Bad data', 'Server ignores the window', {
        server: { records: 'ignoresWindow' },
        data: { spanDays: 200 },
    }),
    preset('Calendars', 'Ethiopian', {
        server: { calendar: 'ethiopian' },
        data: { spanDays: 120, records: 120 },
    }),
    preset('Calendars', 'Nepali', {
        server: { calendar: 'nepali' },
        data: { spanDays: 120, records: 120 },
    }),
    preset('Calendars', 'Coptic', {
        server: { calendar: 'coptic' },
    }),
    preset('Calendars', 'Islamic', {
        server: { calendar: 'islamic' },
    }),
    preset('Calendars', 'Persian', {
        server: { calendar: 'persian' },
    }),
    preset('Calendars', 'Thai', {
        server: { calendar: 'thai' },
    }),
    preset('Calendars', 'Far time zone', {
        server: { timeZone: 'Pacific/Kiritimati' },
    }),
    preset('Saved filters', 'This month', {
        server: { savedFilter: 'thisMonth' },
    }),
    preset('Saved filters', 'Last 30 days', {
        server: { savedFilter: 'last30' },
    }),
    preset('Saved filters', 'Next 90 days of appointments', {
        data: { ...events, records: 120, spread: 'future', spanDays: 120 },
        server: { savedFilter: 'next90' },
        view: { dateField: 'eventScheduledAt' },
    }),
    preset('Saved filters', 'Fixed range in the past', {
        server: { savedFilter: 'fixedPast' },
        data: { spanDays: 150 },
    }),
    preset('Server', 'Slow', {
        network: { endpoints: records({ delay: 3000 }) },
    }),
    preset('Server', 'Slow lookups', {
        network: {
            endpoints: {
                organisationUnits: { delay: 5000 },
                users: { delay: 5000 },
            },
        },
    }),
    preset('Server', 'Slow metadata', {
        network: { endpoints: { programs: { delay: 5000 } } },
    }),
    preset('Server', 'Records never arrive', {
        network: { endpoints: records({ behaviour: 'hangs' }) },
    }),
    preset('Server', 'Records fail', {
        network: { endpoints: records({ behaviour: 'fails' }) },
    }),
    preset('Server', 'Metadata fails', {
        network: { endpoints: { programs: { behaviour: 'fails' } } },
    }),
    preset('Server', 'DHIS2 2.41', {
        server: { apiVersion: 41 },
        data: { records: 450, spanDays: 15 },
    }),
    preset('Server', 'DHIS2 2.40', {
        server: { apiVersion: 40 },
    }),
    preset('Props', 'Read-only records', { view: { clickable: false } }),
    preset('Props', 'Controlled day', { view: { controlledDay: true } }),
    preset('Props', 'Grid only', {
        view: { navigation: false, dayRecords: false },
    }),
    preset('Props', 'Event field on tracked entities', {
        view: { dateField: 'eventScheduledAt' },
    }),
]
