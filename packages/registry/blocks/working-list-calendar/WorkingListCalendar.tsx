import i18n from '@dhis2/d2-i18n'
import { getNowInCalendar, useDatePicker } from '@dhis2/multi-calendar-dates'
import React, {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState,
    type ComponentPropsWithoutRef,
} from 'react'
import { cn } from '@/components/dhis2/ui/cn'
import { Spinner } from '@/components/dhis2/ui/spinner'
import {
    useWorkingListCellText,
    useWorkingListDateRange,
    useWorkingListMeta,
    useWorkingListState,
    type WorkingListDatedRecord,
    type WorkingListDateRangeResults,
    type WorkingListDisplayRow,
    type WorkingListMeta,
    type WorkingListResultTarget,
} from '@/components/working-list'
import { defaultRecordLabel } from './recordLabel'

const TRACKED_ENTITY_DATE_FIELDS = ['enrolledAt', 'enrollmentOccurredAt']
const EVENT_DATE_FIELDS = ['eventOccurredAt', 'eventScheduledAt']

export type WorkingListCalendarDateField =
    | 'enrolledAt'
    | 'enrollmentOccurredAt'
    | 'eventOccurredAt'
    | 'eventScheduledAt'

export interface WorkingListCalendarRecord {
    id: string
    label: string
    /** The record's day in the system calendar (YYYY-MM-DD). */
    date: string
    target?: WorkingListResultTarget
}

export interface WorkingListCalendarDay {
    /** The day in the system calendar (YYYY-MM-DD). */
    date: string
    label: string | number
    isToday: boolean
    /** False for the neighbouring months' days that fill the first and last week. */
    isInCurrentMonth: boolean
    /** Outside the saved filter's dates. */
    isDisabled: boolean
    records: readonly WorkingListCalendarRecord[]
}

type DatePicker = ReturnType<typeof useDatePicker>

export interface WorkingListCalendarContextValue {
    dateField: WorkingListCalendarDateField
    /** Full weeks around the visible month, neighbouring days included. */
    weeks: ReadonlyArray<ReadonlyArray<WorkingListCalendarDay>>
    /** The visible month's number in the system calendar (1 is the first). */
    visibleMonth: number
    weekDayLabels: readonly string[]
    navigation: Pick<
        DatePicker,
        | 'prevMonth'
        | 'nextMonth'
        | 'currMonth'
        | 'currYear'
        | 'months'
        | 'years'
        | 'navigateToMonth'
        | 'navigateToYear'
    >
    selectedDay: WorkingListCalendarDay | null
    selectDay(date: string | null): void
    /** A day's full name for labels, e.g. "14 November 2026". */
    dayName(day: WorkingListCalendarDay): string
    /** The month has days before the saved filter's start / after its end. */
    atFilterStart: boolean
    atFilterEnd: boolean
    results: WorkingListDateRangeResults
    onRecordClick?: (target: WorkingListResultTarget) => void
}

export const WorkingListCalendarContext =
    createContext<WorkingListCalendarContextValue | null>(null)

/** The calendar's month, days, records and selection, for custom layouts. */
export const useWorkingListCalendar = (): WorkingListCalendarContextValue => {
    const context = useContext(WorkingListCalendarContext)
    if (!context) {
        throw new Error(
            'useWorkingListCalendar must be used within WorkingListCalendar.'
        )
    }
    return context
}

type SelectedDayProps =
    | {
          selectedDay?: never
          /** The day selected on mount, in the system calendar (YYYY-MM-DD). */
          defaultSelectedDay?: string | null
          onSelectedDayChange?: (date: string | null) => void
      }
    | {
          /** The selected day in the system calendar (YYYY-MM-DD). */
          selectedDay: string | null
          defaultSelectedDay?: never
          onSelectedDayChange: (date: string | null) => void
      }

export type WorkingListCalendarProps = Omit<
    ComponentPropsWithoutRef<'section'>,
    'onSelect'
> &
    SelectedDayProps & {
        /**
         * The date that places each record. Defaults to the enrollment date
         * for tracked entities and the report date for events. A field that
         * does not fit the list's mode falls back to that default.
         */
        dateField?: WorkingListCalendarDateField
        /** Opens a record. Without it, records are listed but not interactive. */
        onRecordClick?: (target: WorkingListResultTarget) => void
        /** Most records loaded per month. Defaults to 1000. */
        limit?: number
        /**
         * Names a record in the grid and the day list. `cellText` formats any
         * of the row's fields as the table shows it. Defaults to the first two
         * visible columns that have a value, leaving out the calendar's date.
         */
        recordLabel?: (
            row: WorkingListDisplayRow,
            cellText: (fieldId: string) => string
        ) => string
    }

const resolveDateField = (
    mode: 'trackedEntity' | 'event',
    dateField?: WorkingListCalendarDateField
): WorkingListCalendarDateField => {
    const fitting =
        mode === 'event' ? EVENT_DATE_FIELDS : TRACKED_ENTITY_DATE_FIELDS
    if (dateField && fitting.includes(dateField)) return dateField
    return mode === 'event' ? 'eventOccurredAt' : 'enrolledAt'
}

type PickerCalendar = NonNullable<
    Parameters<typeof useDatePicker>[0]['options']['calendar']
>
type SystemCalendar = NonNullable<WorkingListMeta['systemInfo']>['calendar']

// useDatePicker maps DHIS2 calendar ids at runtime, but its types accept only
// Temporal ids and the library does not export its map.
export const PICKER_CALENDARS = {
    coptic: 'coptic',
    ethiopian: 'ethiopic',
    gregorian: 'gregory',
    islamic: 'islamic',
    iso8601: 'iso8601',
    nepali: 'nepali',
    persian: 'persian',
    thai: 'buddhist',
} satisfies Record<SystemCalendar, PickerCalendar>

const pad = (value: number, length = 2) => String(value).padStart(length, '0')

/** Today in the system calendar, written the way the date picker writes days. */
const todayIn = (calendar: string, timeZone: string) => {
    const now = getNowInCalendar(calendar, timeZone)
    return `${pad(now.eraYear ?? now.year, 4)}-${pad(now.month)}-${pad(now.day)}`
}

/** Moves `day` inside `bounds`, so the calendar opens where records can be. */
const clampDay = (day: string, bounds: { start?: string; end?: string }) => {
    if (bounds.end && day > bounds.end) return bounds.end
    if (bounds.start && day < bounds.start) return bounds.start
    return day
}

const isOutside = (day: string, bounds: { start?: string; end?: string }) =>
    Boolean(
        (bounds.start && day < bounds.start) || (bounds.end && day > bounds.end)
    )

const toCalendarRecord = (
    record: WorkingListDatedRecord,
    label: string
): WorkingListCalendarRecord => ({
    id: record.row.id,
    label: label.trim() || i18n.t('Unnamed record'),
    date: record.date,
    target: record.target,
})

const ReadyCalendar = ({
    dateField: requestedDateField,
    onRecordClick,
    limit,
    recordLabel,
    selectedDay: controlledSelectedDay,
    defaultSelectedDay = null,
    onSelectedDayChange,
    className,
    children,
    ...props
}: WorkingListCalendarProps) => {
    const mode = useWorkingListState((state) => state.configuration.mode)
    const columns = useWorkingListState((state) => state.configuration.columns)
    const systemInfo = useWorkingListMeta((meta) => meta.systemInfo)
    const cellText = useWorkingListCellText()
    const dateField = resolveDateField(mode, requestedDateField)
    const calendar = systemInfo?.calendar ?? 'gregorian'
    const timeZone = systemInfo?.serverTimeZoneId ?? 'UTC'

    const [uncontrolledSelectedDay, setUncontrolledSelectedDay] =
        useState(defaultSelectedDay)
    const selectedDate =
        controlledSelectedDay === undefined
            ? uncontrolledSelectedDay
            : controlledSelectedDay
    const selectDay = useCallback(
        (date: string | null) => {
            if (controlledSelectedDay === undefined) {
                setUncontrolledSelectedDay(date)
            }
            onSelectedDayChange?.(date)
        },
        [controlledSelectedDay, onSelectedDayChange]
    )

    // The picker opens on `date` and follows it when it changes, so the
    // filter's bounds can move the calendar once they are known.
    const [filterBounds, setFilterBounds] = useState<{
        start?: string
        end?: string
    }>({})
    const anchor = useMemo(
        () => clampDay(todayIn(calendar, timeZone), filterBounds),
        [calendar, filterBounds, timeZone]
    )
    const picker = useDatePicker({
        date: selectedDate ?? anchor,
        options: {
            calendar: PICKER_CALENDARS[calendar],
            timeZone,
            locale: i18n.language ?? globalThis.navigator?.language ?? 'en',
        },
        onDateSelect: (payload) =>
            selectDay(payload?.calendarDateString ?? null),
    })

    const monthDays = picker.calendarWeekDays
        .flat()
        .filter((day) => day.isInCurrentMonth)
    const gridDays = picker.calendarWeekDays.flat()
    const results = useWorkingListDateRange({
        fieldId: dateField,
        start: gridDays[0]?.dateValue ?? anchor,
        end: gridDays.at(-1)?.dateValue ?? anchor,
        limit,
    })
    if (
        results.filterBounds.start !== filterBounds.start ||
        results.filterBounds.end !== filterBounds.end
    ) {
        setFilterBounds(results.filterBounds)
    }

    const labelFor = useCallback(
        (row: WorkingListDisplayRow) => {
            const text = (fieldId: string) => cellText(row, fieldId)
            return recordLabel
                ? recordLabel(row, text)
                : defaultRecordLabel(
                      columns.filter((id) => id !== dateField),
                      text
                  )
        },
        [cellText, columns, dateField, recordLabel]
    )
    const records = results.status === 'ready' ? results.records : undefined
    const recordsByDay = useMemo(() => {
        const byDay = new Map<string, WorkingListCalendarRecord[]>()
        for (const record of records ?? []) {
            const day = byDay.get(record.date) ?? []
            // A server can send a record twice; it still sits on its day once.
            if (day.some(({ id }) => id === record.row.id)) continue
            day.push(toCalendarRecord(record, labelFor(record.row)))
            byDay.set(record.date, day)
        }
        return byDay
    }, [labelFor, records])

    const weeks = picker.calendarWeekDays.map((week) =>
        week.map((day) => ({
            date: day.dateValue,
            label: day.label,
            isToday: day.isToday,
            isInCurrentMonth: day.isInCurrentMonth,
            isDisabled: isOutside(day.dateValue, filterBounds),
            records: recordsByDay.get(day.dateValue) ?? [],
        }))
    )
    const selectedDay =
        weeks.flat().find((day) => day.date === selectedDate) ?? null
    // Picker days are written YYYY-MM-DD in the system calendar.
    const monthOf = (date: string) => Number(date.slice(5, 7))
    const yearOf = (date: string) => Number(date.slice(0, 4))

    const firstDay = monthDays[0]?.dateValue
    const lastDay = monthDays.at(-1)?.dateValue
    const value: WorkingListCalendarContextValue = {
        dateField,
        weeks,
        visibleMonth: firstDay ? monthOf(firstDay) : 1,
        weekDayLabels: picker.weekDayLabels,
        navigation: picker,
        selectedDay,
        selectDay,
        dayName: (day) => {
            const month =
                picker.months.find(({ value }) => value === monthOf(day.date))
                    ?.label ?? picker.currMonth.label
            const year =
                picker.years.find(({ value }) => value === yearOf(day.date))
                    ?.label ?? yearOf(day.date)
            return `${day.label} ${month} ${year}`
        },
        atFilterStart: Boolean(
            filterBounds.start && firstDay && firstDay <= filterBounds.start
        ),
        atFilterEnd: Boolean(
            filterBounds.end && lastDay && lastDay >= filterBounds.end
        ),
        results,
        onRecordClick,
    }

    return (
        <WorkingListCalendarContext.Provider value={value}>
            <section
                aria-label={i18n.t('Calendar')}
                {...props}
                data-slot="working-list-calendar"
                className={cn('flex flex-col gap-2', className)}
            >
                {children}
            </section>
        </WorkingListCalendarContext.Provider>
    )
}

const unavailableMessage = (status: 'pending' | 'error' | 'ready') =>
    status === 'error'
        ? i18n.t('This working list is unavailable.')
        : i18n.t('Loading the working list…')

/**
 * Shows the working list's records on a month calendar. Render it inside
 * `WorkingList`, beside or instead of `WorkingListTable`, and compose
 * `WorkingListCalendarNavigation`, `WorkingListCalendarGrid` and
 * `WorkingListCalendarDayRecords` inside it.
 */
export const WorkingListCalendar = (props: WorkingListCalendarProps) => {
    // List state can be read only once the list has an active configuration.
    const readiness = useWorkingListMeta((meta) => {
        if (
            meta.lifecycle.status === 'error' ||
            meta.selection.status === 'error'
        ) {
            return 'error'
        }
        return meta.activeConfiguration.status === 'ready' ? 'ready' : 'pending'
    })
    if (readiness === 'ready') return <ReadyCalendar {...props} />

    const {
        dateField: _dateField,
        onRecordClick: _onRecordClick,
        limit: _limit,
        recordLabel: _recordLabel,
        selectedDay: _selectedDay,
        defaultSelectedDay: _defaultSelectedDay,
        onSelectedDayChange: _onSelectedDayChange,
        className,
        children: _children,
        ...sectionProps
    } = props
    return (
        <section
            aria-label={i18n.t('Calendar')}
            aria-busy={readiness === 'pending'}
            {...sectionProps}
            data-slot="working-list-calendar"
            className={cn(
                'flex items-center gap-2 p-4 text-sm text-dhis2-grey-700',
                className
            )}
        >
            {readiness === 'pending' && <Spinner />}
            {unavailableMessage(readiness)}
        </section>
    )
}
