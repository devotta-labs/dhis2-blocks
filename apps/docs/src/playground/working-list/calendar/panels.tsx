import { useCalendarDay } from '@/components/calendar'

/** A cell part of the lab's own: the day's record count, big, in the middle of the cell. */
export const PlainCount = () => {
    const { day } = useCalendarDay()
    if (day.records.length === 0) return null
    return (
        <span className="flex flex-1 items-center justify-center text-[20px] leading-7 font-semibold text-dhis2-foreground tabular-nums">
            {day.records.length}
        </span>
    )
}
