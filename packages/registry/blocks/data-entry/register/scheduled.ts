import {
    addToCalendarDate,
    convertFromIso8601,
    convertToIso8601,
    formatCalendarDate,
} from '@dhis2/multi-calendar-dates'
import type { Dhis2Calendar } from '@/components/dhis2-value-display'
import type { RegisterMetadata } from './metadata'

type LibraryCalendar = Parameters<typeof convertFromIso8601>[1]

/** An ISO day plus whole days, counted on the server's calendar. */
const addDays = (isoDay: string, days: number, calendar: Dhis2Calendar) => {
    if (days === 0) {
        return isoDay
    }
    // SAFETY: the library maps DHIS2's calendar names itself; its types list only the names it maps them to.
    const library = calendar as LibraryCalendar
    const local = addToCalendarDate(
        convertFromIso8601(isoDay, library),
        { days },
        library
    )
    return formatCalendarDate(
        convertToIso8601(formatCalendarDate(local), library)
    )
}

/**
 * The events Capture creates when it enrols a person: one scheduled event for each stage that generates one,
 * dated as Capture dates it. `dates.occurredAt` is the incident date. The days are ISO `YYYY-MM-DD`.
 */
export const scheduledEventsFor = (
    metadata: RegisterMetadata,
    dates: { enrolledAt: string; occurredAt?: string },
    calendar: Dhis2Calendar = 'gregorian'
): Array<{ stageId: string; scheduledAt: string; occurredAt?: string }> => {
    const events = []
    for (const [stageId, stage] of metadata.stages) {
        if (!stage.autoGenerateEvent) {
            continue
        }
        const from = stage.generatedByEnrollmentDate
            ? dates.enrolledAt
            : (dates.occurredAt ?? dates.enrolledAt)
        const dateToReport = {
            enrollmentDate: dates.enrolledAt,
            incidentDate: dates.occurredAt,
        }
        const occurredAt =
            stage.reportDateToUse && dateToReport[stage.reportDateToUse]
        events.push({
            stageId,
            scheduledAt: addDays(
                from,
                stage.openAfterEnrollment ? 0 : stage.minDaysFromStart,
                calendar
            ),
            ...(occurredAt !== undefined && { occurredAt }),
        })
    }
    return events
}
