import i18n from '@dhis2/d2-i18n'
import { getNowInCalendar } from '@dhis2/multi-calendar-dates'
import { z } from 'zod'
import {
    TRACKER_ENROLLMENT_STATUSES,
    TRACKER_EVENT_STATUSES,
} from '../api/schemas'
import type { WorkingListDisplayRow } from './contracts'

const EnrollmentStatusSchema = z.enum(TRACKER_ENROLLMENT_STATUSES)
const EventStatusSchema = z.enum(TRACKER_EVENT_STATUSES)

export interface WorkingListRecordStatus {
    id:
        | z.infer<typeof EnrollmentStatusSchema>
        | z.infer<typeof EventStatusSchema>
    label: string
}

const rawValue = (row: WorkingListDisplayRow, fieldId: string) => {
    const cell = row.values[fieldId]
    return cell?.valid ? cell.value : undefined
}

/**
 * A record's default status: the event status for event lists, with
 * scheduled visits before today marked overdue, otherwise the enrollment
 * status. Dates are compared in the DHIS2 server time zone, not the browser's.
 */
export const getWorkingListRecordStatus = (
    row: WorkingListDisplayRow,
    cellText: (fieldId: string) => string,
    timeZone: string
): WorkingListRecordStatus | undefined => {
    const event = EventStatusSchema.safeParse(rawValue(row, 'eventStatus'))
    if (event.success) {
        const scheduled = z
            .string()
            .safeParse(rawValue(row, 'eventScheduledAt'))
        const now = getNowInCalendar('iso8601', timeZone)
        const isoToday = `${String(now.year).padStart(4, '0')}-${String(now.month).padStart(2, '0')}-${String(now.day).padStart(2, '0')}`
        if (
            event.data === 'SCHEDULE' &&
            scheduled.success &&
            scheduled.data.slice(0, 10) < isoToday
        ) {
            return { id: 'OVERDUE', label: i18n.t('Overdue') }
        }
        return {
            id: event.data,
            label: cellText('eventStatus') || event.data,
        }
    }
    const enrollment = EnrollmentStatusSchema.safeParse(
        rawValue(row, 'enrollmentStatus')
    )
    if (enrollment.success) {
        return {
            id: enrollment.data,
            label: cellText('enrollmentStatus') || enrollment.data,
        }
    }
    return undefined
}
