import i18n from '@dhis2/d2-i18n'
import React, {
    useMemo,
    type ComponentPropsWithoutRef,
    type ReactNode,
} from 'react'
import { cn } from '@/components/dhis2/ui/cn'
import { CalendarContext } from './context'
import type { CalendarRecord, CalendarResults, CalendarState } from './types'
import { useCalendarState, type CalendarOptions } from './useCalendarState'

interface CalendarDataProps {
    /** Plain records for local data. For remote data, supply results instead. */
    records?: readonly CalendarRecord[]
    results?: CalendarResults
    onRecordClick?: (record: CalendarRecord) => void
}

export type CalendarProviderProps = CalendarDataProps & {
    state: CalendarState
    children?: ReactNode
}

const EMPTY_RECORDS: readonly CalendarRecord[] = []

/** Connects calendar state to local records or a data source's loading results. */
export const CalendarProvider = ({
    state,
    records = EMPTY_RECORDS,
    results = { status: 'ready', records },
    onRecordClick,
    children,
}: CalendarProviderProps) => {
    const readyRecords =
        results.status === 'ready' ? results.records : EMPTY_RECORDS
    const recordsByDay = useMemo(() => {
        const byDay = new Map<string, CalendarRecord[]>()
        const placed = new Set<string>()
        for (const record of readyRecords) {
            if (placed.has(record.id)) continue
            placed.add(record.id)
            const day = byDay.get(record.date) ?? []
            day.push(record)
            byDay.set(record.date, day)
        }
        return byDay
    }, [readyRecords])
    const weeks = state.weeks.map((week) =>
        week.map((day) => ({
            ...day,
            records: recordsByDay.get(day.date) ?? [],
        }))
    )
    const selectedDay =
        weeks.flat().find((day) => day.date === state.selectedDay?.date) ?? null
    return (
        <CalendarContext.Provider
            value={{
                state: {
                    weeks,
                    selectedDay,
                    results,
                    visibleRange: state.visibleRange,
                    visibleMonth: state.visibleMonth,
                    display: state.display,
                    atStart: state.atStart,
                    atEnd: state.atEnd,
                },
                actions: {
                    selectDay: state.selectDay,
                    setDisplay: state.setDisplay,
                    prevMonth: state.navigation.prevMonth,
                    nextMonth: state.navigation.nextMonth,
                    navigateToMonth: state.navigation.navigateToMonth,
                    navigateToYear: state.navigation.navigateToYear,
                    onRecordClick,
                },
                meta: {
                    weekDayLabels: state.weekDayLabels,
                    dayName: state.dayName,
                    currMonth: state.navigation.currMonth,
                    currYear: state.navigation.currYear,
                    months: state.navigation.months,
                    years: state.navigation.years,
                },
            }}
        >
            <div
                data-slot="calendar-layout"
                className="grid grid-cols-1 items-start gap-3 *:col-start-1 @3xl:has-[>[data-calendar-panel]]:grid-cols-[minmax(0,1fr)_18rem] @3xl:[&>[data-calendar-panel]]:col-start-2 @3xl:[&>[data-calendar-panel]]:row-span-6 @3xl:[&>[data-calendar-panel]]:row-start-1"
            >
                {children}
            </div>
        </CalendarContext.Provider>
    )
}

export type CalendarProps = Omit<
    ComponentPropsWithoutRef<'section'>,
    'onSelect'
> &
    CalendarOptions &
    CalendarDataProps

const ReadyCalendar = (props: CalendarProps) => {
    const state = useCalendarState(props)
    const {
        calendar: _calendar,
        timeZone: _timeZone,
        locale: _locale,
        start: _start,
        end: _end,
        selectedDay: _selectedDay,
        defaultSelectedDay: _defaultSelectedDay,
        onSelectedDayChange: _onSelectedDayChange,
        display: _display,
        defaultDisplay: _defaultDisplay,
        onDisplayChange: _onDisplayChange,
        records,
        results,
        onRecordClick,
        className,
        children,
        ...sectionProps
    } = props
    return (
        <section
            aria-label={i18n.t('Calendar')}
            {...sectionProps}
            data-slot="calendar"
            className={cn('@container', className)}
        >
            <CalendarProvider
                state={state}
                records={records}
                results={results}
                onRecordClick={onRecordClick}
            >
                {children}
            </CalendarProvider>
        </section>
    )
}

/** A calendar for any dated records. No data provider or Working List required. */
export const Calendar = ({
    calendar = 'gregorian',
    ...props
}: CalendarProps) => {
    // multi-calendar-dates 3.2.1 throws for Coptic dates.
    if (calendar === 'coptic') {
        return (
            <p className="m-0 p-4 text-sm text-dhis2-muted-foreground">
                {i18n.t(
                    'The calendar layout does not support the Coptic calendar yet.'
                )}
            </p>
        )
    }
    return <ReadyCalendar {...props} calendar={calendar} />
}
