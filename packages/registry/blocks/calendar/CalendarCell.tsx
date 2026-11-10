import i18n from '@dhis2/d2-i18n'
import React, { createContext, useContext } from 'react'
import { cn } from '@/components/dhis2/ui/cn'
import { useCalendar, type CalendarDay, type CalendarRecord } from './context'
import type { CalendarStatus, CalendarTone } from './types'

export const TONE_DOT = {
    neutral: 'bg-dhis2-neutral-indicator',
    info: 'bg-dhis2-info-indicator',
    positive: 'bg-dhis2-success-indicator',
    warning: 'bg-dhis2-warning-indicator',
    critical: 'bg-dhis2-destructive-indicator',
} satisfies Record<CalendarTone, string>

export const TONE_CHIP = {
    neutral: 'bg-dhis2-neutral-fill text-dhis2-neutral-strong',
    info: 'bg-dhis2-info-fill text-dhis2-info-strong',
    positive: 'bg-dhis2-success-fill text-dhis2-success-strong',
    warning: 'bg-dhis2-warning-fill text-dhis2-warning-strong',
    critical: 'bg-dhis2-destructive-fill text-dhis2-destructive-strong',
} satisfies Record<CalendarTone, string>

interface DayContextValue {
    day: CalendarDay
    /** The day sits in a narrowed column and has room for little. */
    compact: boolean
}

export const CalendarDayContext = createContext<DayContextValue | null>(null)

/** The day a cell part is drawing, for cell parts of your own. */
export const useCalendarDay = (): DayContextValue => {
    const context = useContext(CalendarDayContext)
    if (!context) {
        throw new Error('useCalendarDay must be used within CalendarGrid.')
    }
    return context
}

const NO_STATUS: CalendarStatus = {
    id: '',
    label: '',
    tone: 'neutral',
}

/** Status groups, largest first; records without a status count as neutral. */
const groupByStatus = (records: readonly CalendarRecord[]) => {
    const groups = new Map<string, { status: CalendarStatus; count: number }>()
    for (const record of records) {
        const status = record.status ?? NO_STATUS
        const group = groups.get(status.id) ?? { status, count: 0 }
        group.count += 1
        groups.set(status.id, group)
    }
    // Ties break by label, so groups keep one order from day to day.
    return [...groups.values()].sort(
        (a, b) =>
            b.count - a.count || a.status.label.localeCompare(b.status.label)
    )
}

const TONE_EDGE = {
    neutral: 'border-dhis2-neutral-indicator',
    info: 'border-dhis2-info-indicator',
    positive: 'border-dhis2-success-indicator',
    warning: 'border-dhis2-warning-indicator',
    critical: 'border-dhis2-destructive-indicator',
} satisfies Record<CalendarTone, string>

const TONE_TINT = {
    neutral: 'bg-dhis2-neutral-subtle',
    info: 'bg-dhis2-info-subtle',
    positive: 'bg-dhis2-success-subtle',
    warning: 'bg-dhis2-warning-subtle',
    critical: 'bg-dhis2-destructive-subtle',
} satisfies Record<CalendarTone, string>

/** Labels a count of records that have no status: "1 record", "7 records". */
const recordsWord = (count: number) =>
    count === 1 ? i18n.t('record') : i18n.t('records')

/** The records a day has beyond what it shows, on a row of their own. */
const MoreRow = ({ count }: { count: number }) =>
    count > 0 ? (
        <span className="px-1 pt-0.5 text-[13px] leading-5 text-dhis2-muted-foreground">
            {i18n.t('+{{count}} more', { count })}
        </span>
    ) : null

const Counts = ({
    records,
    compact,
    max,
}: {
    records: readonly CalendarRecord[]
    compact: boolean
    max: number
}) => {
    const groups = groupByStatus(records)
    const shown = groups.slice(0, Math.max(0, max))
    const hidden = groups
        .slice(shown.length)
        .reduce((sum, { count }) => sum + count, 0)
    return (
        <span className="flex flex-col gap-0.5">
            {shown.map(({ status, count }) => (
                <span
                    key={status.id}
                    className={cn(
                        'flex min-w-0 items-baseline gap-1.5 rounded-e-sm border-s-2 px-1 text-[13px] leading-5 text-dhis2-foreground',
                        TONE_TINT[status.tone],
                        TONE_EDGE[status.tone]
                    )}
                >
                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                        {count}
                    </span>
                    {!compact && (
                        <span className="min-w-0 flex-1 truncate text-dhis2-muted-foreground">
                            {status.label || recordsWord(count)}
                        </span>
                    )}
                </span>
            ))}
            <MoreRow count={hidden} />
        </span>
    )
}

/**
 * A day's records, following the calendar's display: up to `max` status
 * counts (largest first) or `max` names, with the records left over counted
 * on a row of their own.
 */
export const CalendarCellRecords = ({ max = 3 }: { max?: number }) => {
    const {
        state: { display },
    } = useCalendar()
    const { day, compact } = useCalendarDay()
    if (day.records.length === 0) return null
    if (display === 'counts' || compact) {
        return <Counts records={day.records} compact={compact} max={max} />
    }
    const shown = day.records.slice(0, Math.max(0, max))
    const hidden = day.records.length - shown.length
    return (
        <span className="flex min-w-0 flex-col gap-0.5">
            {shown.map((record) => (
                <span
                    key={record.id}
                    className={cn(
                        'truncate rounded-sm px-1 text-[13px] leading-5',
                        TONE_CHIP[record.status?.tone ?? 'neutral']
                    )}
                >
                    {record.label}
                </span>
            ))}
            <MoreRow count={hidden} />
        </span>
    )
}
