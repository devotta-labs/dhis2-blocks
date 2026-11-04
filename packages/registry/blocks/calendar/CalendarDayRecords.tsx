import i18n from '@dhis2/d2-i18n'
import React, { type ComponentPropsWithoutRef } from 'react'
import { Button } from '@/components/dhis2/ui/button'
import { cn } from '@/components/dhis2/ui/cn'
import { useCalendar, type CalendarDay, type CalendarRecord } from './context'
import { TONE_DOT } from './CalendarCell'

const RecordName = ({ record }: { record: CalendarRecord }) => {
    const {
        actions: { onRecordClick },
    } = useCalendar()
    if (onRecordClick && !record.disabled) {
        return (
            <Button
                variant="link"
                size="sm"
                className="h-auto min-w-0 justify-start px-0 text-start whitespace-normal text-dhis2-grey-900"
                onClick={() => onRecordClick(record)}
            >
                {record.label}
            </Button>
        )
    }
    return <span className="text-sm text-dhis2-grey-900">{record.label}</span>
}

const RecordList = ({ day }: { day: CalendarDay }) => {
    if (day.records.length === 0) {
        return (
            <p className="m-0 text-sm text-dhis2-grey-700">
                {i18n.t('No records on this day.')}
            </p>
        )
    }
    return (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {day.records.map((record) => (
                <li key={record.id} className="flex items-start gap-2">
                    <span
                        aria-hidden="true"
                        className={cn(
                            'mt-1.5 size-2 shrink-0 rounded-full',
                            TONE_DOT[record.status?.tone ?? 'neutral']
                        )}
                    />
                    <span className="flex min-w-0 flex-col">
                        <RecordName record={record} />
                        {record.status?.label && (
                            <span className="text-xs text-dhis2-grey-700">
                                {record.status.label}
                            </span>
                        )}
                    </span>
                </li>
            ))}
        </ul>
    )
}

/**
 * Every record on the selected day, which is where a day's counts and
 * "+N more" lead. On a wide calendar it takes a column beside the grid.
 */
export const CalendarDayRecords = ({
    className,
    ...props
}: ComponentPropsWithoutRef<'section'>) => {
    const {
        state: { selectedDay },
        meta: { dayName },
    } = useCalendar()

    return (
        <section
            aria-live="polite"
            {...props}
            data-slot="calendar-day-records"
            className={cn(
                'flex flex-col gap-2 rounded-dhis2-sm border border-dhis2-grey-300 bg-white p-3 @3xl:sticky @3xl:top-2 @3xl:col-start-2 @3xl:row-span-6 @3xl:row-start-1',
                className
            )}
        >
            {selectedDay ? (
                <>
                    <h3 className="m-0 flex items-baseline justify-between gap-2 text-sm font-medium text-dhis2-grey-900">
                        {dayName(selectedDay)}
                        <span className="text-xs font-normal text-dhis2-grey-700 tabular-nums">
                            {selectedDay.records.length === 1
                                ? i18n.t('1 record')
                                : i18n.t('{{count}} records', {
                                      count: selectedDay.records.length,
                                  })}
                        </span>
                    </h3>
                    <RecordList day={selectedDay} />
                </>
            ) : (
                <p className="m-0 text-sm text-dhis2-grey-700">
                    {i18n.t('Select a day to see its records.')}
                </p>
            )}
        </section>
    )
}
