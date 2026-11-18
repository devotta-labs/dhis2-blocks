import i18n from '@dhis2/d2-i18n'
import { useMemo, type ReactNode } from 'react'
import {
    CalendarProvider,
    useCalendarState,
    type CalendarDisplayProps,
    type CalendarRecord,
    type CalendarResults,
    type CalendarSelectionProps,
    type CalendarStatus,
} from '@/components/calendar'
import {
    usePatientListQuery,
    type PatientListEnrollmentStatus,
    type PatientListQuery,
    type PatientListRow,
} from '@/components/patient-list'

export type PatientCalendarProps = CalendarSelectionProps &
    CalendarDisplayProps & {
        /** The list's current query; the calendar keeps its program, org unit and filters. */
        query: PatientListQuery
        /** Default 'enrolledAt'. */
        dateField?: 'enrolledAt' | 'occurredAt'
        /** Most records to load for the visible weeks. Default 1000. */
        limit?: number
        recordLabel: (row: PatientListRow) => string
        onRecordClick?: (row: PatientListRow) => void
        className?: string
        children?: ReactNode
    }

const statusOf = (status: PatientListEnrollmentStatus): CalendarStatus => {
    switch (status) {
        case 'ACTIVE':
            return { id: status, label: i18n.t('Active'), tone: 'info' }
        case 'COMPLETED':
            return { id: status, label: i18n.t('Completed'), tone: 'positive' }
        case 'CANCELLED':
            return { id: status, label: i18n.t('Cancelled'), tone: 'neutral' }
    }
}

/** The later of a filter's own bound and the calendar's (ISO dates compare as text). */
const later = (bound: string | undefined, start: string) =>
    bound !== undefined && bound > start ? bound : start

const earlier = (bound: string | undefined, end: string) =>
    bound !== undefined && bound < end ? bound : end

/**
 * The tracked entities of a patient list on the Calendar block, one record
 * per enrollment on its enrollment (or incident) date.
 *
 * App-owned: copy it and choose your own labels and colours. It loads the
 * visible weeks in one request of up to `limit` records, and says so when
 * there are more. Dates are read as ISO (Gregorian) dates, so it suits
 * instances on the ISO calendar only.
 */
export const PatientCalendar = ({
    query,
    dateField = 'enrolledAt',
    limit = 1000,
    recordLabel,
    onRecordClick,
    className,
    children,
    ...calendarOptions
}: PatientCalendarProps) => {
    const state = useCalendarState(calendarOptions)
    const { start, end } = state.visibleRange
    const range =
        dateField === 'enrolledAt'
            ? {
                  enrolledAfter: later(query.enrolledAfter, start),
                  enrolledBefore: earlier(query.enrolledBefore, end),
              }
            : {
                  occurredAfter: later(query.occurredAfter, start),
                  occurredBefore: earlier(query.occurredBefore, end),
              }
    const result = usePatientListQuery({
        ...query,
        ...range,
        page: 1,
        pageSize: limit,
        order: ['enrolledAt:asc'],
    })
    const rows = result.data?.rows

    const { records, rowsById } = useMemo(() => {
        const byId = new Map<string, PatientListRow>()
        const dated: CalendarRecord[] = []
        for (const row of rows ?? []) {
            const value = row.enrollment?.[dateField]
            if (!value) continue
            byId.set(row.trackedEntity, row)
            dated.push({
                id: row.trackedEntity,
                date: value.slice(0, 10),
                label: recordLabel(row),
                status: row.enrollment && statusOf(row.enrollment.status),
            })
        }
        return { records: dated, rowsById: byId }
    }, [rows, dateField, recordLabel])

    const results = ((): CalendarResults => {
        if (result.data !== undefined) {
            return {
                status: 'ready',
                records,
                truncated: result.data.hasNextPage,
                isUpdating: result.isPlaceholderData,
            }
        }
        if (result.isError) {
            return { status: 'error', retry: () => void result.refetch() }
        }
        return { status: 'pending' }
    })()

    return (
        <section
            aria-label={i18n.t('Calendar')}
            className={`@container ${className ?? ''}`}
        >
            <CalendarProvider
                state={state}
                results={results}
                onRecordClick={
                    onRecordClick &&
                    ((record) => {
                        const row = rowsById.get(record.id)
                        if (row) onRecordClick(row)
                    })
                }
            >
                {children}
            </CalendarProvider>
        </section>
    )
}
