import {
    Timeline,
    TimelineFeed,
    TimelineTime,
    type TimelineEntry,
} from '@/components/timeline'

/**
 * The timeline with data your app already has.
 *
 * Entries are a plain array: an id, the stored date or date-time, and your own
 * data. Dates are placeholders relative to 2026-10-23 so the preview always
 * has something in each phase; in your app they come from your records.
 */
interface Visit {
    clinic: string
    reason: string
}

const NOW = new Date(2026, 9, 23, 12, 0)

const visits: TimelineEntry<Visit>[] = [
    {
        id: 'visit-follow-up',
        at: '2026-11-05',
        precision: 'day',
        data: { clinic: 'Ngelehun CHC', reason: 'Follow-up' },
    },
    {
        id: 'visit-missed',
        at: '2026-10-01',
        precision: 'day',
        phase: 'overdue',
        data: { clinic: 'Ngelehun CHC', reason: 'Missed vaccination' },
    },
    {
        id: 'visit-antenatal',
        at: '2026-10-20T09:30:00.000',
        data: { clinic: 'Ngelehun CHC', reason: 'Antenatal care' },
    },
    {
        id: 'visit-lab',
        at: '2026-10-20T11:15:00.000',
        data: { clinic: 'Bo Government Hospital', reason: 'Lab results' },
    },
    {
        id: 'visit-registration',
        at: '2026-09-14T08:00:00.000',
        data: { clinic: 'Njandama MCHP', reason: 'Registration' },
    },
]

const TimelineOwnData = () => (
    <Timeline<Visit>
        entries={visits}
        calendar="iso8601"
        locale="en"
        now={NOW}
        className="p-6"
    >
        <TimelineFeed<Visit>>
            {(entry) => (
                <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                    <span className="font-medium">{entry.data.reason}</span>
                    <span className="text-muted-foreground">
                        {entry.data.clinic}
                    </span>
                    <TimelineTime entry={entry} />
                </div>
            )}
        </TimelineFeed>
    </Timeline>
)

export default TimelineOwnData
