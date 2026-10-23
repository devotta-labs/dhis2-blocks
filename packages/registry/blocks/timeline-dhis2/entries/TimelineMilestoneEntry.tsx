import i18n from '@dhis2/d2-i18n'
import React, { type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/components/dhis2/ui/cn'
import type { TimelineEntry } from '@/components/timeline/core/types'
import { TimelineTime } from '@/components/timeline/ui/TimelineParts'
import type { Dhis2MilestoneData, MilestoneKind } from '../types'

const label = (kind: MilestoneKind): string => {
    switch (kind) {
        case 'enrolled':
            return i18n.t('Enrolled')
        case 'incident':
            return i18n.t('Incident')
        case 'completed':
            return i18n.t('Enrollment completed')
        case 'cancelled':
            return i18n.t('Enrollment cancelled')
    }
}

/** Enrolled, incident, completed or cancelled, with the program it belongs to. */
export const TimelineMilestoneEntry = ({
    entry,
    className,
    ...props
}: ComponentPropsWithoutRef<'div'> & {
    entry: TimelineEntry<Dhis2MilestoneData>
}) => (
    <div
        {...props}
        data-slot="timeline-milestone"
        className={cn(
            'flex flex-wrap items-baseline gap-x-2 text-sm',
            className
        )}
    >
        <span className="font-medium text-dhis2-grey-900">
            {label(entry.data.milestone)}
        </span>
        <span className="text-dhis2-grey-700">
            {entry.data.program?.name ?? entry.data.enrollment.program}
        </span>
        <TimelineTime entry={entry} />
    </div>
)
