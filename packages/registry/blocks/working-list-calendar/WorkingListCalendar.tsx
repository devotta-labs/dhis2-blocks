import i18n from '@dhis2/d2-i18n'
import React, { useMemo, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/components/dhis2/ui/cn'
import { Spinner } from '@/components/dhis2/ui/spinner'
import {
    Calendar,
    CalendarProvider,
    useCalendarState,
    type CalendarSelectionProps,
    type CalendarDisplayProps,
} from '@/components/calendar'
import { todayIn } from '@/components/calendar/useCalendarState'
import {
    WorkingListSelectionError,
    useWorkingListDateBounds,
    useWorkingListDateRange,
    useWorkingListMeta,
    useWorkingListState,
    type WorkingListDateBounds,
    type WorkingListDateFieldId,
    type WorkingListDisplayRow,
    type WorkingListResultTarget,
} from '@/components/working-list'
import {
    WorkingListCalendarContext,
    type WorkingListCalendarRecord,
} from './context'
import { defaultRecordLabel } from './recordLabel'
import {
    defaultRecordStatus,
    type WorkingListCalendarStatus,
} from './recordStatus'

const TRACKED_ENTITY_DATE_FIELDS = ['enrolledAt', 'enrollmentOccurredAt']
const EVENT_DATE_FIELDS = ['eventOccurredAt', 'eventScheduledAt']

export type WorkingListCalendarDateField = WorkingListDateFieldId

export type WorkingListCalendarProps = Omit<
    ComponentPropsWithoutRef<'section'>,
    'onSelect'
> &
    CalendarSelectionProps &
    CalendarDisplayProps & {
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

const ReadyCalendar = (
    props: WorkingListCalendarProps & {
        dateField: WorkingListCalendarDateField
        bounds: WorkingListDateBounds
    }
) => {
    const {
        dateField,
        bounds,
        onRecordClick,
        limit,
        recordLabel,
        recordStatus,
        children,
    } = props
    const columns = useWorkingListState((state) => state.configuration.columns)
    const state = useCalendarState({ ...props, ...bounds })
    const results = useWorkingListDateRange({
        fieldId: dateField,
        ...state.visibleRange,
        limit,
    })
    const ready = results.status === 'ready' ? results : undefined
    const sourceRecords = ready?.records
    const cellText = ready?.cellText
    const isoToday = todayIn('iso8601', bounds.timeZone)
    const records = useMemo((): WorkingListCalendarRecord[] => {
        if (!sourceRecords || !cellText) return []
        const labelColumns = columns.filter((id) => id !== dateField)
        return sourceRecords.map((record) => {
            const text = (fieldId: string) => cellText(record.row, fieldId)
            const label = recordLabel
                ? recordLabel(record.row, text)
                : defaultRecordLabel(labelColumns, text)
            return {
                id: record.row.id,
                date: record.date,
                target: record.target,
                disabled: !record.target,
                label: label.trim() || i18n.t('Unnamed record'),
                status: recordStatus
                    ? recordStatus(record.row, text)
                    : defaultRecordStatus(record.row, text, isoToday),
            }
        })
    }, [
        sourceRecords,
        cellText,
        columns,
        dateField,
        isoToday,
        recordLabel,
        recordStatus,
    ])
    const recordsById = useMemo(() => {
        const byId = new Map<string, WorkingListCalendarRecord>()
        for (const record of records) {
            if (!byId.has(record.id)) byId.set(record.id, record)
        }
        return byId
    }, [records])
    return (
        <WorkingListCalendarContext.Provider
            value={{ dateField, results, recordsById, onRecordClick }}
        >
            <CalendarProvider
                state={state}
                results={
                    results.status === 'ready'
                        ? { ...results, records }
                        : results
                }
                onRecordClick={
                    onRecordClick
                        ? (record) => {
                              const target = recordsById.get(record.id)?.target
                              if (target) onRecordClick(target)
                          }
                        : undefined
                }
            >
                {children}
            </CalendarProvider>
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
    if (bounds.calendar === 'coptic') return <Calendar calendar="coptic" />
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
