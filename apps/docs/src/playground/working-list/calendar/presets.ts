import type { LabNetwork } from '../../network'
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
    network: { delay: 50, endpoints: {} },
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

export const PRESETS: readonly Preset[] = [
    preset('Dates', 'Clinic enrollments'),
    preset('Dates', 'Upcoming appointments', {
        data: { ...events, records: 120, spread: 'future', spanDays: 75 },
        view: { dateField: 'eventScheduledAt' },
    }),
    preset('Dates', 'Visits done', {
        data: { ...events, records: 90, spread: 'past', spanDays: 75 },
        view: { dateField: 'eventOccurredAt' },
    }),
    preset('Days', 'Every day busy', {
        data: { records: 400, spanDays: 20 },
    }),
    preset('Days', 'Names', {
        data: { records: 300, spanDays: 20 },
        view: { display: 'records' },
    }),
    preset('Days', 'Status by location', {
        data: { records: 300, spanDays: 20 },
        view: { recordStatus: 'location' },
    }),
    preset('Data', 'Empty', { data: { records: 0 } }),
    preset('Data', 'Long names', { data: { names: 'long' } }),
    preset('Data', 'Unicode and right-to-left', {
        data: { names: 'unicode' },
    }),
]
