import i18n from '@dhis2/d2-i18n'
import React from 'react'
import type { TimelineEntry } from '../../core/types'
import { TimelineItem, TimelineTime } from '../../ui/TimelineParts'
import type { MilestoneEntryData, MilestoneKind } from '../useEnrollmentSources'

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

/** Enrolled, incident, completed or cancelled: a single line with nothing to recompose. */
export const TimelineMilestoneEntry = ({
    entry,
}: {
    entry: TimelineEntry<MilestoneEntryData>
}) => (
    <TimelineItem entry={entry}>
        <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <span className="font-medium text-dhis2-grey-900">
                {label(entry.data.kind)}
            </span>
            <TimelineTime entry={entry} />
        </div>
    </TimelineItem>
)
