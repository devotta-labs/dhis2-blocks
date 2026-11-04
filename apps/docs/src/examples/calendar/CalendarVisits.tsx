import { IconCalendar16 } from '@dhis2/ui-icons'
import { Button } from '@/components/dhis2/ui/button'
import {
    Calendar,
    CalendarNavigation,
    CalendarGrid,
    CalendarDayRecords,
    type CalendarRecord,
} from '@/components/calendar'

const visits: CalendarRecord[] = [
    {
        id: 'anc-001',
        date: '2026-11-03',
        label: 'Esther N. · ANC visit 3',
        status: { id: 'completed', label: 'Completed', tone: 'positive' },
    },
    {
        id: 'anc-002',
        date: '2026-11-04',
        label: 'Rose K. · ANC visit 2',
        status: { id: 'completed', label: 'Completed', tone: 'positive' },
    },
    {
        id: 'anc-003',
        date: '2026-11-10',
        label: 'Amina N. · ANC visit 2',
        status: { id: 'scheduled', label: 'Scheduled', tone: 'info' },
    },
    {
        id: 'anc-004',
        date: '2026-11-10',
        label: 'Grace A. · ANC visit 1',
        status: { id: 'scheduled', label: 'Scheduled', tone: 'info' },
    },
    {
        id: 'anc-005',
        date: '2026-11-10',
        label: 'Sarah O. · ANC visit 3',
        status: { id: 'scheduled', label: 'Scheduled', tone: 'info' },
    },
    {
        id: 'anc-006',
        date: '2026-11-12',
        label: 'Mary K. · ANC visit 4',
        status: { id: 'scheduled', label: 'Scheduled', tone: 'info' },
    },
    {
        id: 'anc-007',
        date: '2026-11-13',
        label: 'Fatima M. · ANC visit 2',
        status: { id: 'scheduled', label: 'Scheduled', tone: 'info' },
    },
    {
        id: 'anc-008',
        date: '2026-11-18',
        label: 'Jane A. · ANC visit 1',
        status: { id: 'scheduled', label: 'Scheduled', tone: 'info' },
    },
]

const CalendarVisits = () => (
    <div className="p-4">
        <Calendar
            records={visits}
            defaultSelectedDay="2026-11-10"
            defaultDisplay="records"
        >
            <div className="flex flex-wrap items-center justify-between gap-2">
                <CalendarNavigation />
                <Button type="button" size="sm">
                    <IconCalendar16 />
                    Schedule
                </Button>
            </div>
            <CalendarGrid weekend={[6, 7]} weekendColumns="narrow" />
            <CalendarDayRecords />
        </Calendar>
    </div>
)

export default CalendarVisits
