import type * as Engine from '@dhis2/rule-engine'
import type {
    EventRuleInput,
    RuleContext,
    RuleEngineModule,
    RuleEnrollmentInput,
    RuleEventInput,
} from './types'
import { normaliseValue, toInstant, toLocalDate } from './valueTypes'

export type InputContext = Pick<
    RuleContext,
    'programName' | 'stageNames' | 'valueTypes'
>

export interface EngineInput {
    event: Engine.RuleEventJs
    enrollment: Engine.RuleEnrollmentJs | null
    otherEvents: Engine.RuleEventJs[]
}

const normalisedValues = (
    context: InputContext,
    values: Record<string, string>
): [string, string][] =>
    Object.entries(values).flatMap(([fieldId, value]) => {
        const normalised = normaliseValue(
            value,
            context.valueTypes.get(fieldId)
        )
        return normalised === null ? [] : [[fieldId, normalised]]
    })

const toEngineEvent = (
    engine: RuleEngineModule,
    context: InputContext,
    event: RuleEventInput
): Engine.RuleEventJs =>
    new engine.RuleEventJs(
        event.id,
        event.programStageId,
        context.stageNames.get(event.programStageId) ?? '',
        engine.RuleEventStatus.valueOf(event.status),
        toLocalDate(engine, event.occurredAt),
        toInstant(engine, event.createdAt) ?? engine.RuleInstant.now(),
        null,
        toLocalDate(engine, event.scheduledAt),
        toLocalDate(engine, event.completedAt),
        event.orgUnitId,
        event.orgUnitCode ?? null,
        normalisedValues(context, event.dataValues).map(
            ([dataElement, value]) =>
                new engine.RuleDataValue(dataElement, value)
        )
    )

const toEngineEnrollment = (
    engine: RuleEngineModule,
    context: InputContext,
    enrollment: RuleEnrollmentInput
): Engine.RuleEnrollmentJs | null => {
    const enrolledAt = toLocalDate(engine, enrollment.enrolledAt)
    if (enrolledAt === null) {
        return null
    }
    return new engine.RuleEnrollmentJs(
        enrollment.id,
        context.programName,
        toLocalDate(engine, enrollment.occurredAt) ?? enrolledAt,
        enrolledAt,
        engine.RuleEnrollmentStatus.valueOf(enrollment.status ?? 'ACTIVE'),
        enrollment.orgUnitId,
        enrollment.orgUnitCode ?? null,
        normalisedValues(context, enrollment.attributes).map(
            ([attribute, value]) =>
                new engine.RuleAttributeValue(attribute, value)
        )
    )
}

export const buildEngineInput = (
    engine: RuleEngineModule,
    context: InputContext,
    input: EventRuleInput
): EngineInput => ({
    event: toEngineEvent(engine, context, input.event),
    enrollment:
        input.enrollment === undefined
            ? null
            : toEngineEnrollment(engine, context, input.enrollment),
    // The current event's stored values would compete with the edited ones.
    otherEvents: input.otherEvents
        .filter((other) => other.id !== input.event.id)
        .map((other) => toEngineEvent(engine, context, other)),
})
