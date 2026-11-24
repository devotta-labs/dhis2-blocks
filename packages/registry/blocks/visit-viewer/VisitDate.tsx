import React, { type ComponentProps } from 'react'
import { cn } from '@/components/dhis2/ui/cn'
import {
    formatCalendarDate,
    storedDay,
    storedTime,
    type Dhis2Calendar,
} from '@/components/dhis2-value-display'
import { useVisitViewer } from './context'

export interface VisitDateProps extends Omit<
    ComponentProps<'time'>,
    'children' | 'dateTime'
> {
    /** The date or date-time exactly as DHIS2 stored it, such as `2026-11-12` or `2026-11-12T14:30:00.000`. */
    value: string
    /** Overrides the `VisitViewer`'s calendar; Gregorian outside one. */
    calendar?: Dhis2Calendar
    /** Overrides the `VisitViewer`'s locale. */
    locale?: string
    /** Adds the stored time of day, when the value has one. */
    showTime?: boolean
    /** Words before the date, such as "Due". */
    prefix?: string
}

/**
 * A stored date in the system calendar, read from the string as written and
 * never through the browser's time zone. An unreadable value shows as is.
 */
export const VisitDate = ({
    value,
    calendar,
    locale,
    showTime = false,
    prefix,
    className,
    ...props
}: VisitDateProps) => {
    const settings = useVisitViewer()
    const day = storedDay(value)
    const time = showTime ? storedTime(value) : undefined
    const date =
        day === undefined
            ? value
            : formatCalendarDate(
                  day,
                  calendar ?? settings.calendar,
                  locale ?? settings.locale
              )
    let dateTime = day
    if (day !== undefined && time !== undefined) {
        dateTime = `${day}T${time}`
    }
    return (
        <time
            dateTime={dateTime}
            data-slot="visit-date"
            className={cn('whitespace-nowrap tabular-nums', className)}
            {...props}
        >
            {prefix === undefined ? null : (
                <span data-slot="visit-date-prefix">{`${prefix} `}</span>
            )}
            {time === undefined ? date : `${date} ${time}`}
        </time>
    )
}
