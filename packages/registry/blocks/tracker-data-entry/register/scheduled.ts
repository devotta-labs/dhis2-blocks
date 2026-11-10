import { addDaysIso } from '@/components/dhis2-value-types'
import type { Dhis2Calendar } from '@/components/dhis2-value-display'
import type { RegisterMetadata } from './metadata'

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
            scheduledAt: addDaysIso(
                from,
                stage.openAfterEnrollment ? 0 : stage.minDaysFromStart,
                calendar
            ),
            ...(occurredAt !== undefined && { occurredAt }),
        })
    }
    return events
}
