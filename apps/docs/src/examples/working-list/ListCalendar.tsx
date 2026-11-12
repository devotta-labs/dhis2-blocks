import i18n from '@dhis2/d2-i18n'
import { useMemo, type ReactNode } from 'react'
import {
    Calendar,
    CalendarProvider,
    useCalendarState,
    type CalendarDisplayProps,
    type CalendarSelectionProps,
    type CalendarStatus,
    type CalendarTone,
} from '@/components/calendar'
import {
    WorkingListSelectionError,
    getWorkingListRecordStatus,
    useWorkingListDateBounds,
    useWorkingListDateRange,
    useWorkingListView,
    type WorkingListConfiguration,
    type WorkingListDateBounds,
    type WorkingListDateFieldId,
    type WorkingListDisplayRow,
    type WorkingListRecordStatus,
    type WorkingListResultTarget,
} from '@/components/working-list'

export type ListCalendarProps = CalendarSelectionProps &
    CalendarDisplayProps & {
        children?: ReactNode
        className?: string
        dateField?: WorkingListDateFieldId
        limit?: number
        onRecordClick?: (target: WorkingListResultTarget) => void
        recordLabel?: (
            row: WorkingListDisplayRow,
            cellText: (fieldId: string) => string
        ) => string
        recordStatus?: (
            row: WorkingListDisplayRow,
            cellText: (fieldId: string) => string
        ) => CalendarStatus | undefined
    }

const TONES = {
    ACTIVE: 'info',
    COMPLETED: 'positive',
    CANCELLED: 'neutral',
    SCHEDULE: 'info',
    VISITED: 'warning',
    OVERDUE: 'critical',
    SKIPPED: 'neutral',
} satisfies Record<WorkingListRecordStatus['id'], CalendarTone>

const ReadyCalendar = ({
    configuration: { columns },
    dateField,
    bounds,
    limit,
    recordLabel,
    recordStatus,
    onRecordClick,
    children,
    ...options
}: ListCalendarProps & {
    configuration: WorkingListConfiguration
    dateField: WorkingListDateFieldId
    bounds: WorkingListDateBounds
}) => {
    const state = useCalendarState({ ...options, ...bounds })
    const results = useWorkingListDateRange({
        fieldId: dateField,
        ...state.visibleRange,
        limit,
    })
    const ready = results.status === 'ready' ? results : undefined
    const { records, targets } = useMemo(() => {
        const targets = new Map<string, WorkingListResultTarget>()
        const records = (ready?.records ?? []).map(({ row, date, target }) => {
            const text = (fieldId: string) =>
                ready?.cellText(row, fieldId) ?? ''
            if (target && !targets.has(row.id)) targets.set(row.id, target)
            const label = recordLabel
                ? recordLabel(row, text)
                : columns
                      .filter((id) => id !== dateField)
                      .map((id) => text(id).trim())
                      .filter(Boolean)
                      .slice(0, 2)
                      .join(' ')
            const status = getWorkingListRecordStatus(
                row,
                text,
                bounds.timeZone
            )
            const defaultStatus: CalendarStatus | undefined = status
                ? {
                      ...status,
                      tone:
                          status.id === 'ACTIVE' && row.eventId
                              ? 'warning'
                              : TONES[status.id],
                  }
                : undefined
            return {
                id: row.id,
                date,
                label: label.trim() || i18n.t('Unnamed record'),
                disabled: !target,
                status: recordStatus ? recordStatus(row, text) : defaultStatus,
            }
        })
        return { records, targets }
    }, [ready, columns, dateField, bounds.timeZone, recordLabel, recordStatus])

    return (
        <CalendarProvider
            state={state}
            results={
                results.status === 'ready' ? { ...results, records } : results
            }
            onRecordClick={
                onRecordClick
                    ? (record) => {
                          const target = targets.get(record.id)
                          if (target) onRecordClick(target)
                      }
                    : undefined
            }
        >
            {children}
        </CalendarProvider>
    )
}

const DatedCalendar = (
    props: ListCalendarProps & { configuration: WorkingListConfiguration }
) => {
    const fields: WorkingListDateFieldId[] =
        props.configuration.mode === 'event'
            ? ['eventOccurredAt', 'eventScheduledAt']
            : ['enrolledAt', 'enrollmentOccurredAt']
    const dateField =
        props.dateField && fields.includes(props.dateField)
            ? props.dateField
            : fields[0]
    const bounds = useWorkingListDateBounds(dateField)
    if (!bounds) return <p>{i18n.t('Loading the working list…')}</p>
    if (bounds.calendar === 'coptic') return <Calendar calendar="coptic" />
    return <ReadyCalendar {...props} dateField={dateField} bounds={bounds} />
}

/** App-owned composition: copy this recipe and choose your own labels and colours. */
export const ListCalendar = ({ className, ...props }: ListCalendarProps) => {
    const view = useWorkingListView()
    return (
        <section
            aria-label={i18n.t('Calendar')}
            aria-busy={view.isPending}
            className={`@container ${className ?? ''}`}
        >
            {view.isError && <WorkingListSelectionError />}
            {view.isPending && <p>{i18n.t('Loading the working list…')}</p>}
            {view.data && (
                <DatedCalendar
                    {...props}
                    configuration={view.data.configuration}
                />
            )}
        </section>
    )
}
