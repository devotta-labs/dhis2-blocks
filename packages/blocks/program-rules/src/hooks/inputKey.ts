import type { RuleEnrollmentInput, RuleEventInput } from '../index'
import type { ProgramRulesInput } from './useProgramRules'

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

/** Equal for inputs with the same content, whatever their identity or key order. */
export const inputContentKey = (input: ProgramRulesInput): string =>
    JSON.stringify([
        eventKey(input.event),
        input.enrollment === undefined ? null : enrollmentKey(input.enrollment),
        input.otherEvents === undefined
            ? null
            : input.otherEvents.map(eventKey),
    ])
