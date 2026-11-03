import { useWorkingListDateBounds } from '@/components/working-list'
import {
    useWorkingListCalendar,
    useWorkingListCalendarDay,
} from '@/components/working-list-calendar'

/** What the calendar holds right now, read through its public hook. */
export const CalendarReadout = () => {
    const calendar = useWorkingListCalendar()
    const { results } = calendar
    const bounds = useWorkingListDateBounds(calendar.dateField)
    const rows: Array<[string, string]> = [
        ['dateField', calendar.dateField],
        ['visibleMonth', String(calendar.visibleMonth)],
        ['selectedDay', calendar.selectedDay?.date ?? 'null'],
        ['display', calendar.display],
        ['results.status', results.status],
        [
            'records',
            results.status === 'ready' ? String(results.records.length) : '—',
        ],
        [
            'truncated',
            results.status === 'ready' ? String(results.truncated) : '—',
        ],
        ['filterBounds', `${bounds?.start ?? '…'} → ${bounds?.end ?? '…'}`],
        [
            'atFilterStart / End',
            `${calendar.atFilterStart} / ${calendar.atFilterEnd}`,
        ],
    ]
    return (
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 rounded border border-dashed border-dhis2-grey-500 bg-dhis2-grey-050 p-2 font-mono text-xs">
            {rows.map(([name, value]) => (
                <div key={name} className="contents">
                    <dt className="text-dhis2-grey-700">{name}</dt>
                    <dd className="m-0">{value}</dd>
                </div>
            ))}
        </dl>
    )
}

/** A cell part of the lab's own: the day's record count, big, in the middle of the cell. */
export const PlainCount = () => {
    const { day } = useWorkingListCalendarDay()
    if (day.records.length === 0) return null
    return (
        <span className="flex flex-1 items-center justify-center text-[20px] leading-7 font-semibold text-dhis2-grey-900 tabular-nums">
            {day.records.length}
        </span>
    )
}
