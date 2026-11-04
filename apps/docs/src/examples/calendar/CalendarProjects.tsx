import { useState } from 'react'
import {
    Calendar,
    CalendarNavigation,
    CalendarDisplayToggle,
    CalendarGrid,
    CalendarDayRecords,
    type CalendarRecord,
} from '@/components/calendar'

const milestones: CalendarRecord[] = [
    {
        id: 'design',
        date: '2026-11-10',
        label: 'Design review',
        status: { id: 'done', label: 'Done', tone: 'positive' },
    },
    {
        id: 'release',
        date: '2026-11-10',
        label: 'Release candidate',
        status: { id: 'planned', label: 'Planned', tone: 'info' },
    },
    {
        id: 'docs',
        date: '2026-11-13',
        label: 'Publish documentation',
        status: { id: 'planned', label: 'Planned', tone: 'info' },
    },
    {
        id: 'launch',
        date: '2026-11-18',
        label: 'Product launch',
        status: { id: 'review', label: 'Needs review', tone: 'warning' },
    },
]

const CalendarProjects = () => {
    const [opened, setOpened] = useState<string | null>(null)
    return (
        <div className="p-4">
            <Calendar
                records={milestones}
                defaultSelectedDay="2026-11-10"
                defaultDisplay="records"
                onRecordClick={(record) => setOpened(record.label)}
            >
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <CalendarNavigation />
                    <CalendarDisplayToggle />
                </div>
                <CalendarGrid weekend={[6, 7]} weekendColumns="narrow" />
                <CalendarDayRecords />
            </Calendar>
            <p className="mt-3 text-sm text-dhis2-grey-700" aria-live="polite">
                {opened
                    ? `Opened: ${opened}`
                    : 'Select a milestone to open it.'}
            </p>
        </div>
    )
}

export default CalendarProjects
