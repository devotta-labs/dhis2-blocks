import i18n from '@dhis2/d2-i18n'
import React, {
    useRef,
    useState,
    type ComponentPropsWithoutRef,
    type KeyboardEvent,
    type ReactNode,
} from 'react'
import { Button } from '@/components/dhis2/ui/button'
import { ErrorAlert } from '@/components/dhis2/ui/alert'
import { cn } from '@/components/dhis2/ui/cn'
import { Spinner } from '@/components/dhis2/ui/spinner'
import { useCalendar, type CalendarDay } from './context'
import { CalendarCellRecords, CalendarDayContext } from './CalendarCell'

/** An ISO weekday: 1 is Monday, 7 is Sunday. */
export type CalendarWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

// Forced colours would repaint the circle as the page, so it takes system colours there.
export const TODAY_CLASS =
    'inline-flex size-5 items-center justify-center self-start rounded-full bg-dhis2-primary text-dhis2-primary-foreground forced-colors:bg-[Highlight] forced-colors:text-[HighlightText] forced-colors:[forced-color-adjust:none]'

const WEEKDAYS: readonly CalendarWeekday[] = [1, 2, 3, 4, 5, 6, 7]

// shortcut: arrows move in visual order only for left-to-right text; flip them
// for right-to-left once an RTL locale uses the calendar.
const keyOffset = (key: string, rowLength: number) => {
    switch (key) {
        case 'ArrowLeft':
            return -1
        case 'ArrowRight':
            return 1
        case 'ArrowUp':
            return -rowLength
        case 'ArrowDown':
            return rowLength
        default:
            return undefined
    }
}

const recordCountName = (day: CalendarDay, name: string) => {
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

const HiddenDaysNote = ({ count }: { count: number }) =>
    count > 0 ? (
        <p className="m-0 text-sm text-dhis2-muted-foreground">
            {count === 1
                ? i18n.t('1 record falls on a hidden weekend day.')
                : i18n.t('{{count}} records fall on hidden weekend days.', {
                      count,
                  })}
        </p>
    ) : null

const ResultsStatus = () => {
    const {
        state: { results, weeks },
    } = useCalendar()
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
            <p className="m-0 flex items-center gap-2 text-sm text-dhis2-muted-foreground">
                <Spinner />
                {i18n.t('Loading records…')}
            </p>
        )
    }
    if (results.truncated) {
        return (
            <p className="m-0 text-sm text-dhis2-muted-foreground">
                {i18n.t(
                    'Showing the first {{count}} records in these weeks. Narrow the date range to see the rest.',
                    { count: results.records.length }
                )}
            </p>
        )
    }
    if (weeks.every((week) => week.every((day) => day.records.length === 0))) {
        return (
            <p className="m-0 text-sm text-dhis2-muted-foreground">
                {i18n.t('No records this month.')}
            </p>
        )
    }
    return null
}

export interface CalendarGridProps extends ComponentPropsWithoutRef<'div'> {
    /** The weekdays that count as the weekend, e.g. `[6, 7]` or `[5, 6]`. */
    weekend?: readonly CalendarWeekday[]
    /**
     * How weekend columns show: like other days (the default), narrowed to
     * counts, or hidden. Records on hidden days are counted above the grid.
     */
    weekendColumns?: 'show' | 'narrow' | 'hide'
    /**
     * What each day shows under its number: `CalendarCellRecords`
     * (the default) or cell parts of your own built on
     * `useCalendarDay`.
     */
    children?: ReactNode
}

/**
 * The visible month as a grid of days. Each day shows its cell parts and
 * selects itself; arrow keys move between days.
 */
export const CalendarGrid = ({
    weekend = [],
    weekendColumns = 'show',
    className,
    children = <CalendarCellRecords />,
    ...props
}: CalendarGridProps) => {
    const {
        state: { weeks, selectedDay, results },
        actions: { selectDay },
        meta: { weekDayLabels, dayName },
    } = useCalendar()
    const tableRef = useRef<HTMLTableElement>(null)
    const [focusedDate, setFocusedDate] = useState<string | null>(null)
    const isWeekend = (weekday: CalendarWeekday) => weekend.includes(weekday)
    // Weeks start on Monday, so a day's column is its weekday.
    const columns = WEEKDAYS.filter(
        (weekday) => weekendColumns !== 'hide' || !isWeekend(weekday)
    )
    const rows = weeks.map((week) =>
        columns.flatMap((weekday) => {
            const day = week[weekday - 1]
            return day ? [{ day, weekday }] : []
        })
    )
    const days = rows.flat().map(({ day }) => day)
    const hiddenCount =
        weekendColumns === 'hide'
            ? weeks
                  .flatMap((week) =>
                      week.filter((_, index) => isWeekend(WEEKDAYS[index] ?? 1))
                  )
                  .reduce((sum, day) => sum + day.records.length, 0)
            : 0
    const tabStop =
        days.find((day) => day.date === focusedDate) ??
        days.find((day) => day.date === selectedDay?.date) ??
        days.find((day) => day.isToday) ??
        days.find((day) => day.isInCurrentMonth)

    const onKeyDown = (
        event: KeyboardEvent<HTMLButtonElement>,
        day: CalendarDay
    ) => {
        const offset = keyOffset(event.key, columns.length)
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
            data-slot="calendar-grid"
            className={cn('flex min-w-0 flex-col gap-2', className)}
        >
            <ResultsStatus />
            <HiddenDaysNote count={hiddenCount} />
            <table
                ref={tableRef}
                role="grid"
                aria-busy={
                    results.status === 'pending' ||
                    (results.status === 'ready' && results.isUpdating)
                }
                className="w-full table-fixed border-collapse"
            >
                <colgroup>
                    {columns.map((weekday) => (
                        <col
                            key={weekday}
                            className={cn(
                                weekendColumns === 'narrow' &&
                                    isWeekend(weekday) &&
                                    'w-12'
                            )}
                        />
                    ))}
                </colgroup>
                <thead>
                    <tr>
                        {columns.map((weekday) => (
                            <th
                                key={weekday}
                                scope="col"
                                className={cn(
                                    'truncate pb-1 text-xs font-normal text-dhis2-muted-foreground',
                                    isWeekend(weekday) &&
                                        'text-dhis2-subtle-foreground'
                                )}
                            >
                                {weekDayLabels[weekday - 1]}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={row[0]?.day.date}>
                            {row.map(({ day, weekday }) => (
                                <td
                                    key={day.date}
                                    // h-px lets the button fill the row's full height.
                                    className="h-px border border-dhis2-border p-0 align-top"
                                    aria-selected={
                                        day.date === selectedDay?.date
                                    }
                                >
                                    <button
                                        type="button"
                                        data-date={day.date}
                                        data-weekend={
                                            isWeekend(weekday) || undefined
                                        }
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
                                            'flex h-full min-h-24 w-full cursor-pointer flex-col items-stretch gap-1 overflow-hidden bg-dhis2-background p-1.5 text-start hover:bg-dhis2-background-subtle focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-dhis2-ring',
                                            isWeekend(weekday) &&
                                                'bg-dhis2-background-subtle',
                                            !day.isInCurrentMonth &&
                                                'bg-dhis2-background-subtle',
                                            day.isDisabled &&
                                                'cursor-default bg-dhis2-muted hover:bg-dhis2-muted',
                                            day.date === selectedDay?.date &&
                                                'bg-dhis2-primary-subtle shadow-[inset_0_0_0_2px_var(--dhis2-primary)] hover:bg-dhis2-primary-subtle'
                                        )}
                                    >
                                        <span
                                            className={cn(
                                                'text-[13px] leading-5 text-dhis2-muted-foreground',
                                                !day.isInCurrentMonth &&
                                                    'text-dhis2-subtle-foreground',
                                                day.isToday && TODAY_CLASS
                                            )}
                                        >
                                            {day.label}
                                        </span>
                                        <CalendarDayContext.Provider
                                            value={{
                                                day,
                                                compact:
                                                    weekendColumns ===
                                                        'narrow' &&
                                                    isWeekend(weekday),
                                            }}
                                        >
                                            {children}
                                        </CalendarDayContext.Provider>
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
