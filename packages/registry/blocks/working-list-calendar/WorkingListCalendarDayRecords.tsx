import i18n from '@dhis2/d2-i18n'
import React, { type ComponentPropsWithoutRef } from 'react'
import { Button } from '@/components/dhis2/ui/button'
import { cn } from '@/components/dhis2/ui/cn'
import {
    useWorkingListCalendar,
    type WorkingListCalendarDay,
} from './WorkingListCalendar'

const RecordList = ({ day }: { day: WorkingListCalendarDay }) => {
    const { onRecordClick } = useWorkingListCalendar()
    if (day.records.length === 0) {
        return (
            <p className="m-0 text-sm text-dhis2-grey-700">
                {i18n.t('No records on this day.')}
            </p>
        )
    }
    return (
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {day.records.map(({ id, label, target }) => (
                <li key={id}>
                    {onRecordClick && target ? (
                        <Button
                            variant="link"
                            size="sm"
                            className="px-0"
                            onClick={() => onRecordClick(target)}
                        >
                            {label}
                        </Button>
                    ) : (
                        <span className="text-sm text-dhis2-grey-900">
                            {label}
                        </span>
                    )}
                </li>
            ))}
        </ul>
    )
}

/** Every record on the selected day, which is where "+N more" leads. */
export const WorkingListCalendarDayRecords = ({
    className,
    ...props
}: ComponentPropsWithoutRef<'section'>) => {
    const { selectedDay, dayName } = useWorkingListCalendar()

    return (
        <section
            aria-live="polite"
            {...props}
            data-slot="working-list-calendar-day-records"
            className={cn('flex flex-col gap-2', className)}
        >
            {selectedDay ? (
                <>
                    <h3 className="m-0 text-sm font-medium text-dhis2-grey-900">
                        {dayName(selectedDay)}
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
