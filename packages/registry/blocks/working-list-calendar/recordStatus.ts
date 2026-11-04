import i18n from '@dhis2/d2-i18n'
import { z } from 'zod'
import {
    TRACKER_ENROLLMENT_STATUSES,
    TRACKER_EVENT_STATUSES,
    type WorkingListDisplayRow,
} from '@/components/working-list'

import type { CalendarStatus, CalendarTone } from '@/components/calendar'

export type WorkingListCalendarTone = CalendarTone
export type WorkingListCalendarStatus = CalendarStatus

const EnrollmentStatusSchema = z.enum(TRACKER_ENROLLMENT_STATUSES)
const EventStatusSchema = z.enum(TRACKER_EVENT_STATUSES)

const ENROLLMENT_TONES = {
    ACTIVE: 'info',
    COMPLETED: 'positive',
    CANCELLED: 'neutral',
} satisfies Record<
    z.infer<typeof EnrollmentStatusSchema>,
    WorkingListCalendarTone
>

const EVENT_TONES = {
    SCHEDULE: 'info',
    ACTIVE: 'warning',
    VISITED: 'warning',
    COMPLETED: 'positive',
    OVERDUE: 'critical',
    SKIPPED: 'neutral',
} satisfies Record<z.infer<typeof EventStatusSchema>, WorkingListCalendarTone>

const rawValue = (row: WorkingListDisplayRow, fieldId: string) => {
    const cell = row.values[fieldId]
    return cell?.valid ? cell.value : undefined
}

/**
 * A record's default status: the event status for event lists, with
 * scheduled visits before today marked overdue, otherwise the enrollment
 * status. `isoToday` is today's ISO date in the server time zone.
 */
export const defaultRecordStatus = (
    row: WorkingListDisplayRow,
    cellText: (fieldId: string) => string,
    isoToday: string
): WorkingListCalendarStatus | undefined => {
    const event = EventStatusSchema.safeParse(rawValue(row, 'eventStatus'))
    if (event.success) {
        const scheduled = z
            .string()
            .safeParse(rawValue(row, 'eventScheduledAt'))
        if (
            event.data === 'SCHEDULE' &&
            scheduled.success &&
            scheduled.data.slice(0, 10) < isoToday
        ) {
            return { id: 'OVERDUE', label: i18n.t('Overdue'), tone: 'critical' }
        }
        return {
            id: event.data,
            label: cellText('eventStatus') || event.data,
            tone: EVENT_TONES[event.data],
        }
    }
    const enrollment = EnrollmentStatusSchema.safeParse(
        rawValue(row, 'enrollmentStatus')
    )
    if (enrollment.success) {
        return {
            id: enrollment.data,
            label: cellText('enrollmentStatus') || enrollment.data,
            tone: ENROLLMENT_TONES[enrollment.data],
        }
    }
    return undefined
}
