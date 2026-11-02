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
    WorkingListSelectionError,
    useWorkingListDateBounds,
    useWorkingListDateRange,
    useWorkingListMeta,
    useWorkingListState,
    type WorkingListDateBounds,
    type WorkingListDatedRecord,
    type WorkingListDateFieldId,
    type WorkingListDateRangeResults,
    type WorkingListDisplayRow,
    type WorkingListResultTarget,
} from '@/components/working-list'
import { defaultRecordLabel } from './recordLabel'
import {
    defaultRecordStatus,
    type WorkingListCalendarStatus,
} from './recordStatus'

const TRACKED_ENTITY_DATE_FIELDS = ['enrolledAt', 'enrollmentOccurredAt']
const EVENT_DATE_FIELDS = ['eventOccurredAt', 'eventScheduledAt']

export type WorkingListCalendarDateField = WorkingListDateFieldId

export interface WorkingListCalendarRecord {
    id: string
    label: string
    /** The record's day in the system calendar (YYYY-MM-DD). */
    date: string
    target?: WorkingListResultTarget
    /** Colours the record and groups it in the day counts. */
    status?: WorkingListCalendarStatus
}

/** What a day shows: how many records of each status, or their names. */
export type WorkingListCalendarDisplay = 'counts' | 'records'

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
    display: WorkingListCalendarDisplay
    setDisplay(display: WorkingListCalendarDisplay): void
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

type DisplayProps =
    | {
          display?: never
          /** What days show on mount. Defaults to counts. */
          defaultDisplay?: WorkingListCalendarDisplay
          onDisplayChange?: (display: WorkingListCalendarDisplay) => void
      }
    | {
          display: WorkingListCalendarDisplay
          defaultDisplay?: never
          onDisplayChange: (display: WorkingListCalendarDisplay) => void
      }

export type WorkingListCalendarProps = Omit<
    ComponentPropsWithoutRef<'section'>,
    'onSelect'
> &
    SelectedDayProps &
    DisplayProps & {
        /**
         * The date that places each record. Defaults to the enrollment date
         * for tracked entities and the report date for events. A field that
         * does not fit the list's mode falls back to that default.
         */
        dateField?: WorkingListCalendarDateField
        /** Opens a record. Without it, records are listed but not interactive. */
        onRecordClick?: (target: WorkingListResultTarget) => void
        /** Most records loaded for the weeks shown. Defaults to 1000. */
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
        /**
         * Colours a record and groups it in the day counts. Defaults to the
         * enrollment status, or the event status with past scheduled visits
         * marked overdue. Return `undefined` for no status.
         */
        recordStatus?: (
            row: WorkingListDisplayRow,
            cellText: (fieldId: string) => string
        ) => WorkingListCalendarStatus | undefined
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
type SystemCalendar = WorkingListDateBounds['calendar']

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

/** Today in `calendar`, written the way the date picker writes days. */
const todayIn = (calendar: string, timeZone: string) => {
    const now = getNowInCalendar(calendar, timeZone)
    const year = calendar === 'iso8601' ? now.year : (now.eraYear ?? now.year)
    return `${pad(year, 4)}-${pad(now.month)}-${pad(now.day)}`
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
    label: string,
    status: WorkingListCalendarStatus | undefined
): WorkingListCalendarRecord => ({
    id: record.row.id,
    label: label.trim() || i18n.t('Unnamed record'),
    date: record.date,
    target: record.target,
    status,
})

type ReadyCalendarProps = WorkingListCalendarProps & {
    dateField: WorkingListCalendarDateField
    bounds: WorkingListDateBounds
}

const ReadyCalendar = ({
    dateField,
    bounds,
    onRecordClick,
    limit,
    recordLabel,
    recordStatus,
    selectedDay: controlledSelectedDay,
    defaultSelectedDay = null,
    onSelectedDayChange,
    display: controlledDisplay,
    defaultDisplay = 'counts',
    onDisplayChange,
    children,
}: ReadyCalendarProps) => {
    const columns = useWorkingListState((state) => state.configuration.columns)
    const { calendar, timeZone, locale } = bounds

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

    const [uncontrolledDisplay, setUncontrolledDisplay] =
        useState(defaultDisplay)
    const display = controlledDisplay ?? uncontrolledDisplay
    const setDisplay = useCallback(
        (next: WorkingListCalendarDisplay) => {
            if (controlledDisplay === undefined) setUncontrolledDisplay(next)
            onDisplayChange?.(next)
        },
        [controlledDisplay, onDisplayChange]
    )

    // The picker opens on `date` and moves when it changes. Clearing the
    // selection keeps the month in view, so only a newly selected day or,
    // before any selection, the filter's dates move it.
    const [lastSelectedDay, setLastSelectedDay] = useState(selectedDate)
    if (selectedDate !== null && selectedDate !== lastSelectedDay) {
        setLastSelectedDay(selectedDate)
    }
    const anchor = useMemo(
        () => clampDay(todayIn(calendar, timeZone), bounds),
        [bounds, calendar, timeZone]
    )
    const picker = useDatePicker({
        date: selectedDate ?? lastSelectedDay ?? anchor,
        options: { calendar: PICKER_CALENDARS[calendar], timeZone, locale },
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

    const ready = results.status === 'ready' ? results : undefined
    const records = ready?.records
    const cellText = ready?.cellText
    const isoToday = todayIn('iso8601', timeZone)
    const recordsByDay = useMemo(() => {
        const byDay = new Map<string, WorkingListCalendarRecord[]>()
        if (!records || !cellText) return byDay
        const labelColumns = columns.filter((id) => id !== dateField)
        const placed = new Set<string>()
        for (const record of records) {
            // A server can send a record twice; it still sits on its day once.
            if (placed.has(record.row.id)) continue
            placed.add(record.row.id)
            const text = (fieldId: string) => cellText(record.row, fieldId)
            const day = byDay.get(record.date) ?? []
            day.push(
                toCalendarRecord(
                    record,
                    recordLabel
                        ? recordLabel(record.row, text)
                        : defaultRecordLabel(labelColumns, text),
                    recordStatus
                        ? recordStatus(record.row, text)
                        : defaultRecordStatus(record.row, text, isoToday)
                )
            )
            byDay.set(record.date, day)
        }
        return byDay
    }, [
        cellText,
        columns,
        dateField,
        isoToday,
        recordLabel,
        recordStatus,
        records,
    ])

    const weeks = picker.calendarWeekDays.map((week) =>
        week.map((day) => ({
            date: day.dateValue,
            label: day.label,
            isToday: day.isToday,
            isInCurrentMonth: day.isInCurrentMonth,
            isDisabled: isOutside(day.dateValue, bounds),
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
        display,
        setDisplay,
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
            bounds.start && firstDay && firstDay <= bounds.start
        ),
        atFilterEnd: Boolean(bounds.end && lastDay && lastDay >= bounds.end),
        results,
        onRecordClick,
    }

    return (
        <WorkingListCalendarContext.Provider value={value}>
            {/* Wide calendars put the day list in a column of its own. */}
            <div className="grid items-start gap-3 @3xl:grid-cols-[minmax(0,1fr)_18rem]">
                {children}
            </div>
        </WorkingListCalendarContext.Provider>
    )
}

const CalendarLoading = () => (
    <p className="m-0 flex items-center gap-2 p-4 text-sm text-dhis2-grey-700">
        <Spinner />
        {i18n.t('Loading the working list…')}
    </p>
)

/** Places records by the date that fits the list's mode. */
const DatedCalendar = (props: WorkingListCalendarProps) => {
    const mode = useWorkingListState((state) => state.configuration.mode)
    const dateField = resolveDateField(mode, props.dateField)
    const bounds = useWorkingListDateBounds(dateField)
    if (!bounds) return <CalendarLoading />
    return <ReadyCalendar {...props} dateField={dateField} bounds={bounds} />
}

/**
 * Shows the working list's records on a month calendar. Render it inside
 * `WorkingList`, beside or instead of `WorkingListTable`, and compose
 * `WorkingListCalendarNavigation`, `WorkingListCalendarGrid` and
 * `WorkingListCalendarDayRecords` inside it.
 */
export const WorkingListCalendar = (props: WorkingListCalendarProps) => {
    // List state can be read only once the list has an active configuration.
    const readiness = useWorkingListMeta((meta) => {
        if (meta.selection.status === 'error') return 'error'
        return meta.activeConfiguration.status === 'ready' ? 'ready' : 'pending'
    })
    const {
        dateField: _dateField,
        onRecordClick: _onRecordClick,
        limit: _limit,
        recordLabel: _recordLabel,
        recordStatus: _recordStatus,
        display: _display,
        defaultDisplay: _defaultDisplay,
        onDisplayChange: _onDisplayChange,
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
            className={cn('@container', className)}
        >
            {readiness === 'ready' && <DatedCalendar {...props} />}
            {readiness === 'pending' && <CalendarLoading />}
            {readiness === 'error' && <WorkingListSelectionError />}
        </section>
    )
}
