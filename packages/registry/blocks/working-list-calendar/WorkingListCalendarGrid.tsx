import i18n from '@dhis2/d2-i18n'
import React, {
    useRef,
    useState,
    type ComponentPropsWithoutRef,
    type KeyboardEvent,
} from 'react'
import { Button } from '@/components/dhis2/ui/button'
import { ErrorAlert } from '@/components/dhis2/ui/alert'
import { cn } from '@/components/dhis2/ui/cn'
import { Spinner } from '@/components/dhis2/ui/spinner'
import {
    useWorkingListCalendar,
    type WorkingListCalendarDay,
} from './WorkingListCalendar'

const VISIBLE_RECORDS_PER_DAY = 3

// shortcut: arrows move in visual order only for left-to-right text; flip them
// for right-to-left once an RTL locale uses the calendar.
const keyOffset = (key: string) => {
    switch (key) {
        case 'ArrowLeft':
            return -1
        case 'ArrowRight':
            return 1
        case 'ArrowUp':
            return -7
        case 'ArrowDown':
            return 7
        default:
            return undefined
    }
}

const recordCountName = (day: WorkingListCalendarDay, name: string) => {
    if (day.records.length === 0) {
        return i18n.t('{{date}}, no records', { date: name })
    }
    if (day.records.length === 1) {
        return i18n.t('{{date}}, 1 record', { date: name })
    }
    return i18n.t('{{date}}, {{count}} records', {
        date: name,
        count: day.records.length,
    })
}

const ResultsStatus = () => {
    const { results } = useWorkingListCalendar()
    if (results.status === 'error') {
        return (
            <ErrorAlert title={i18n.t('Records could not be loaded')}>
                <Button variant="secondary" size="sm" onClick={results.retry}>
                    {i18n.t('Try again')}
                </Button>
            </ErrorAlert>
        )
    }
    if (results.status === 'pending') {
        return (
            <p className="m-0 flex items-center gap-2 text-sm text-dhis2-grey-700">
                <Spinner />
                {i18n.t('Loading records…')}
            </p>
        )
    }
    if (results.truncated) {
        return (
            <p className="m-0 text-sm text-dhis2-grey-700">
                {i18n.t(
                    'Showing the first {{count}} records this month. Narrow the filters to see the rest.',
                    { count: results.records.length }
                )}
            </p>
        )
    }
    if (results.records.length === 0) {
        return (
            <p className="m-0 text-sm text-dhis2-grey-700">
                {i18n.t('No records this month.')}
            </p>
        )
    }
    return null
}

/**
 * The visible month as a grid of days. Each day shows its first records and
 * selects itself; arrow keys move between days.
 */
export const WorkingListCalendarGrid = ({
    className,
    ...props
}: ComponentPropsWithoutRef<'div'>) => {
    const { weeks, weekDayLabels, selectedDay, selectDay, dayName, results } =
        useWorkingListCalendar()
    const tableRef = useRef<HTMLTableElement>(null)
    const [focusedDate, setFocusedDate] = useState<string | null>(null)
    const days = weeks.flat()
    const tabStop =
        days.find((day) => day.date === focusedDate) ??
        selectedDay ??
        days.find((day) => day.isToday) ??
        days.find((day) => day.isInCurrentMonth)

    const onKeyDown = (
        event: KeyboardEvent<HTMLButtonElement>,
        day: WorkingListCalendarDay
    ) => {
        const offset = keyOffset(event.key)
        if (offset === undefined) return
        const next = days[days.indexOf(day) + offset]
        if (!next) return
        event.preventDefault()
        tableRef.current
            ?.querySelector<HTMLButtonElement>(`[data-date="${next.date}"]`)
            ?.focus()
    }

    return (
        <div
            {...props}
            data-slot="working-list-calendar-grid"
            className={cn('flex flex-col gap-2', className)}
        >
            <ResultsStatus />
            <table
                ref={tableRef}
                role="grid"
                aria-busy={
                    results.status === 'pending' ||
                    (results.status === 'ready' && results.isUpdating)
                }
                className="w-full table-fixed border-separate border-spacing-1"
            >
                <thead>
                    <tr>
                        {weekDayLabels.map((label, index) => (
                            <th
                                // Narrow labels repeat ("T", "S"), so position is the identity.
                                key={index}
                                scope="col"
                                className="pb-1 text-xs font-normal text-dhis2-grey-700"
                            >
                                {label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {weeks.map((week) => (
                        <tr key={week[0]?.date}>
                            {week.map((day) => (
                                <td
                                    key={day.date}
                                    aria-selected={
                                        day.date === selectedDay?.date
                                    }
                                >
                                    <button
                                        type="button"
                                        data-date={day.date}
                                        tabIndex={
                                            day.date === tabStop?.date ? 0 : -1
                                        }
                                        aria-label={recordCountName(
                                            day,
                                            dayName(day)
                                        )}
                                        aria-disabled={day.isDisabled}
                                        aria-current={
                                            day.isToday ? 'date' : undefined
                                        }
                                        onFocus={() => setFocusedDate(day.date)}
                                        onKeyDown={(event) =>
                                            onKeyDown(event, day)
                                        }
                                        onClick={() => {
                                            if (!day.isDisabled) {
                                                selectDay(day.date)
                                            }
                                        }}
                                        className={cn(
                                            'flex h-24 w-full cursor-pointer flex-col items-stretch gap-0.5 overflow-hidden rounded-dhis2-sm border border-dhis2-grey-300 bg-white p-1.5 text-start hover:border-dhis2-grey-500 focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-dhis2-ring',
                                            !day.isInCurrentMonth &&
                                                'border-dhis2-grey-200 bg-dhis2-grey-050',
                                            day.isDisabled &&
                                                'cursor-default border-transparent bg-dhis2-grey-100 hover:border-transparent',
                                            day.date === selectedDay?.date &&
                                                'border-dhis2-blue-600 bg-dhis2-blue-050 shadow-[inset_0_0_0_1px_var(--color-dhis2-blue-600)]'
                                        )}
                                    >
                                        <DayContent day={day} />
                                    </button>
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

const DayContent = ({ day }: { day: WorkingListCalendarDay }) => {
    const hidden = day.records.length - VISIBLE_RECORDS_PER_DAY
    return (
        <>
            <span
                className={cn(
                    'text-xs leading-5 text-dhis2-grey-900',
                    !day.isInCurrentMonth && 'text-dhis2-grey-600',
                    day.isToday &&
                        'inline-flex size-5 items-center justify-center self-start rounded-full bg-dhis2-blue-600 text-white'
                )}
            >
                {day.label}
            </span>
            {day.records.slice(0, VISIBLE_RECORDS_PER_DAY).map((record) => (
                <span
                    key={record.id}
                    className="truncate rounded-sm bg-dhis2-blue-100 px-1 text-[11px] leading-4 text-dhis2-blue-900"
                >
                    {record.label}
                </span>
            ))}
            {hidden > 0 && (
                <span className="px-1 text-[11px] leading-4 text-dhis2-grey-700">
                    {i18n.t('+{{count}} more', { count: hidden })}
                </span>
            )}
        </>
    )
}
