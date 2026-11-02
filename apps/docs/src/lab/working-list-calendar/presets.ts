import type { LabNetwork } from '../network'
import type { LabConfig, LabData, LabServer, LabView } from './labData'

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
    },
    server: {
        records: 'ok',
        calendar: 'gregorian',
        dateFormat: 'YYYY-MM-DD',
        timeZone: 'Africa/Freetown',
        apiVersion: 42,
        savedFilter: 'none',
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
    },
}

export interface Preset {
    group: string
    name: string
    /** What to look for once it loads. */
    note: string
    config: LabConfig
}

const preset = (
    group: string,
    name: string,
    note: string,
    changes: {
        data?: Partial<LabData>
        server?: Partial<LabServer>
        network?: Partial<LabNetwork>
        view?: Partial<LabView>
    } = {}
): Preset => ({
    group,
    name,
    note,
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
    preset(
        'Everyday',
        'Clinic enrollments',
        'Sixty people enrolled over three months, placed by enrollment date.'
    ),
    preset(
        'Everyday',
        'Upcoming appointments',
        'Scheduled follow-up visits in the coming months.',
        {
            data: { ...events, records: 120, spread: 'future', spanDays: 75 },
            view: { dateField: 'eventScheduledAt' },
        }
    ),
    preset(
        'Everyday',
        'Visits done',
        'Completed visits placed by report date.',
        {
            data: { ...events, records: 90, spread: 'past', spanDays: 75 },
            view: { dateField: 'eventOccurredAt' },
        }
    ),
    preset(
        'Everyday',
        'Incident dates',
        'Same people, placed two days earlier by incident date.',
        { view: { dateField: 'enrollmentOccurredAt' } }
    ),
    preset(
        'Everyday',
        'Table and calendar side by side',
        'Both read one list: paging the table must not move the calendar, and the other way round.',
        { view: { layout: 'both' } }
    ),
    preset(
        'Everyday',
        'Table / calendar toggle',
        'The docs recipe. Switching back remounts the calendar on this month.',
        { view: { layout: 'toggle' } }
    ),
    preset(
        'Density',
        'Empty',
        'No records anywhere: an empty grid and one line.',
        {
            data: { records: 0 },
        }
    ),
    preset('Density', 'One record', 'A single person, enrolled today.', {
        data: { records: 1 },
    }),
    preset(
        'Density',
        'Pile-up on one day',
        'Eighty people on one day: three names, "+77 more", and a long day list.',
        { data: { records: 80, spread: 'oneDay' } }
    ),
    preset(
        'Density',
        'Every day busy',
        'Four hundred people over six weeks; several pages per month.',
        { data: { records: 400, spanDays: 20 } }
    ),
    preset(
        'Density',
        'Over the limit',
        'Three hundred people this month with a limit of 100: the truncation notice.',
        { data: { records: 300, spanDays: 10 }, view: { limit: 100 } }
    ),
    preset('Density', 'Clustered weeks', 'Busy days next to empty ones.', {
        data: { records: 150, spread: 'clustered' },
    }),
    preset('Density', 'Weekdays only', 'Nothing on Saturdays or Sundays.', {
        data: { records: 120, spread: 'weekdays' },
    }),
    preset(
        'Density',
        'Sparse, far away',
        'Forty people over two years: most months are empty.',
        { data: { records: 40, spanDays: 400 } }
    ),
    preset('Names', 'Long names', 'Names far wider than a day cell.', {
        data: { names: 'long' },
    }),
    preset(
        'Names',
        'Unicode and right-to-left',
        'Arabic, Amharic, Devanagari, CJK, emoji and combining marks.',
        { data: { names: 'unicode' } }
    ),
    preset(
        'Names',
        'Blank names',
        'Empty and whitespace-only names, and a missing last name.',
        { data: { names: 'blank' } }
    ),
    preset(
        'Names',
        'No name columns',
        'Name attributes are not shown in the list, so labels fall back to the record id.',
        { data: { names: 'unnamed' } }
    ),
    preset(
        'Bad data',
        'Missing dates',
        'A third of the records have no enrollment date and never reach the grid.',
        { data: { missingDates: 33 } }
    ),
    preset(
        'Bad data',
        'Malformed dates',
        'One record in ten has a broken date: the whole month fails to load, as the table does.',
        { data: { badDates: 10 } }
    ),
    preset(
        'Bad data',
        'Duplicate records',
        'One record in five is sent twice.',
        { data: { duplicates: 20 } }
    ),
    preset(
        'Bad data',
        'Server ignores the window',
        'Records from every month arrive; only those on visible days show.',
        { server: { records: 'ignoresWindow' }, data: { spanDays: 200 } }
    ),
    preset('Calendars', 'Ethiopian', 'Thirteen months, Pagume included.', {
        server: { calendar: 'ethiopian' },
        data: { spanDays: 120, records: 120 },
    }),
    preset('Calendars', 'Nepali', 'Months of 29 to 32 days.', {
        server: { calendar: 'nepali' },
        data: { spanDays: 120, records: 120 },
    }),
    preset(
        'Calendars',
        'Coptic',
        'Thirteen months. Crashes inside @dhis2/multi-calendar-dates 3.2.1 (Coptic era years).',
        {
            server: { calendar: 'coptic' },
        }
    ),
    preset('Calendars', 'Islamic', 'Lunar months.', {
        server: { calendar: 'islamic' },
    }),
    preset('Calendars', 'Persian', 'Solar Hijri.', {
        server: { calendar: 'persian' },
    }),
    preset('Calendars', 'Thai', 'Buddhist era years.', {
        server: { calendar: 'thai' },
    }),
    preset(
        'Calendars',
        'Far time zone',
        'Server at UTC+14: "today" may already be tomorrow here.',
        { server: { timeZone: 'Pacific/Kiritimati' } }
    ),
    preset(
        'Saved filters',
        'This month',
        'A saved view filtered to this month: previous and next stay disabled.',
        { server: { savedFilter: 'thisMonth' } }
    ),
    preset('Saved filters', 'Last 30 days', 'Days after today are disabled.', {
        server: { savedFilter: 'last30' },
    }),
    preset(
        'Saved filters',
        'Next 90 days of appointments',
        'An event view filtered on scheduled date.',
        {
            data: { ...events, records: 120, spread: 'future', spanDays: 120 },
            server: { savedFilter: 'next90' },
            view: { dateField: 'eventScheduledAt' },
        }
    ),
    preset(
        'Saved filters',
        'Fixed range in the past',
        'Opens inside the filter, two to four months ago, not on today.',
        { server: { savedFilter: 'fixedPast' }, data: { spanDays: 150 } }
    ),
    preset(
        'Server',
        'Slow',
        'Three seconds per record request: watch the loading line.',
        { network: { endpoints: records({ delay: 3000 }) } }
    ),
    preset(
        'Server',
        'Slow lookups',
        'Records are quick, organisation unit and user names take five seconds: the records should not wait for them.',
        {
            network: {
                endpoints: {
                    organisationUnits: { delay: 5000 },
                    users: { delay: 5000 },
                },
            },
        }
    ),
    preset(
        'Server',
        'Slow metadata',
        'The program takes five seconds: everything that needs it waits, nothing else should.',
        { network: { endpoints: { programs: { delay: 5000 } } } }
    ),
    preset('Server', 'Records never arrive', 'The record request hangs.', {
        network: { endpoints: records({ behaviour: 'hangs' }) },
    }),
    preset(
        'Server',
        'Records fail',
        'A 500 on every record request; try again.',
        {
            network: { endpoints: records({ behaviour: 'fails' }) },
        }
    ),
    preset(
        'Server',
        'Metadata fails',
        'The program cannot load: the list shows its error and the calendar says it is unavailable.',
        { network: { endpoints: { programs: { behaviour: 'fails' } } } }
    ),
    preset(
        'Server',
        'DHIS2 2.41',
        'No next-page link: paging relies on full pages.',
        { server: { apiVersion: 41 }, data: { records: 450, spanDays: 15 } }
    ),
    preset('Server', 'DHIS2 2.40', 'Unsupported version.', {
        server: { apiVersion: 40 },
    }),
    preset(
        'Props',
        'Read-only records',
        'No onRecordClick: day records are plain text.',
        { view: { clickable: false } }
    ),
    preset(
        'Props',
        'Controlled day',
        'The lab owns selectedDay; the log shows each change.',
        { view: { controlledDay: true } }
    ),
    preset('Props', 'Grid only', 'No navigation or day list: only the grid.', {
        view: { navigation: false, dayRecords: false },
    }),
    preset(
        'Props',
        'Event field on tracked entities',
        'dateField="eventScheduledAt" on an enrollment list falls back to enrollment date.',
        { view: { dateField: 'eventScheduledAt' } }
    ),
]
