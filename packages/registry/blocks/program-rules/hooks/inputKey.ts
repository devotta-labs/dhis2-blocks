import type { RuleEnrollmentInput, RuleEventInput } from '../lib'

const sortedEntries = (values: Record<string, string>) =>
    Object.entries(values).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))

const eventKey = (event: RuleEventInput) => [
    event.id,
    event.programStageId,
    event.occurredAt ?? null,
    event.scheduledAt ?? null,
    event.createdAt ?? null,
    event.completedAt ?? null,
    event.orgUnitId,
    event.orgUnitCode ?? null,
    event.status,
    sortedEntries(event.dataValues),
]

const enrollmentKey = (enrollment: RuleEnrollmentInput) => [
    enrollment.id,
    enrollment.enrolledAt,
    enrollment.occurredAt ?? null,
    enrollment.orgUnitId,
    enrollment.orgUnitCode ?? null,
    enrollment.status ?? null,
    sortedEntries(enrollment.attributes),
]

/** Equal for events with the same content, whatever their identity or key order. */
export const eventContentKey = (event: RuleEventInput): string =>
    JSON.stringify(eventKey(event))

/** Equal for the same enrollment data. Missing other events differ from none. */
export const supplementContentKey = (supplement: {
    enrollment?: RuleEnrollmentInput
    otherEvents?: ReadonlyArray<RuleEventInput>
}): string =>
    JSON.stringify([
        supplement.enrollment === undefined
            ? null
            : enrollmentKey(supplement.enrollment),
        supplement.otherEvents === undefined
            ? null
            : supplement.otherEvents.map(eventKey),
    ])
