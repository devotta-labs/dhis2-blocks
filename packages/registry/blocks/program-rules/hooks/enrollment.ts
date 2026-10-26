import type { RuleEnrollmentInput, RuleEventInput } from '../lib'
import { z } from 'zod'
import type { ProgramRulesClient } from './client'

const ValueSchema = z.string().optional()

const EventSchema = z.object({
    event: z.string(),
    programStage: z.string(),
    status: z.enum([
        'ACTIVE',
        'COMPLETED',
        'SCHEDULE',
        'SKIPPED',
        'VISITED',
        'OVERDUE',
    ]),
    occurredAt: z.string().optional(),
    scheduledAt: z.string().optional(),
    createdAt: z.string().optional(),
    completedAt: z.string().optional(),
    orgUnit: z.string(),
    dataValues: z
        .array(z.object({ dataElement: z.string(), value: ValueSchema }))
        .default([]),
})

export const RuleEnrollmentResponseSchema = z.object({
    enrollment: z.string(),
    status: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED']),
    enrolledAt: z.string(),
    occurredAt: z.string().optional(),
    orgUnit: z.string(),
    attributes: z
        .array(z.object({ attribute: z.string(), value: ValueSchema }))
        .default([]),
    events: z.array(EventSchema).default([]),
})

export type RuleEnrollmentResponse = z.infer<
    typeof RuleEnrollmentResponseSchema
>

export interface RuleEnrollmentData {
    enrollment: RuleEnrollmentInput
    events: RuleEventInput[]
}

const presentValues = (
    entries: ReadonlyArray<readonly [string, string | undefined]>
): Record<string, string> =>
    Object.fromEntries(
        entries.flatMap(([id, value]) =>
            value === undefined || value === '' ? [] : [[id, value]]
        )
    )

const toEvent = (event: z.infer<typeof EventSchema>): RuleEventInput => ({
    id: event.event,
    programStageId: event.programStage,
    status: event.status,
    occurredAt: event.occurredAt,
    scheduledAt: event.scheduledAt,
    createdAt: event.createdAt,
    completedAt: event.completedAt,
    orgUnitId: event.orgUnit,
    dataValues: presentValues(
        event.dataValues.map((value) => [value.dataElement, value.value])
    ),
})

/** A tracker enrollment response → rule input. `events` includes every event; the lib drops the current one. */
export const toRuleEnrollmentData = (
    response: RuleEnrollmentResponse
): RuleEnrollmentData => ({
    enrollment: {
        id: response.enrollment,
        status: response.status,
        enrolledAt: response.enrolledAt,
        occurredAt: response.occurredAt,
        orgUnitId: response.orgUnit,
        attributes: presentValues(
            response.attributes.map((value) => [value.attribute, value.value])
        ),
    },
    events: response.events.map(toEvent),
})

const EVENT_FIELDS =
    'event,programStage,status,occurredAt,scheduledAt,createdAt,completedAt,orgUnit,dataValues[dataElement,value]'

export const fetchRuleEnrollment = async (
    client: ProgramRulesClient,
    enrollmentId: string,
    withEvents: boolean,
    signal?: AbortSignal
): Promise<RuleEnrollmentData> => {
    const fields = `enrollment,status,enrolledAt,occurredAt,orgUnit,attributes[attribute,value]${withEvents ? `,events[${EVENT_FIELDS}]` : ''}`
    const response = await client.query(
        {
            enrollment: {
                resource: 'tracker/enrollments',
                id: enrollmentId,
                params: { fields },
            },
        },
        z.object({ enrollment: RuleEnrollmentResponseSchema }),
        signal
    )
    return toRuleEnrollmentData(response.enrollment)
}
