import type {
    EventRuleInput,
    RuleContext,
    RuleEventInput,
    RuleOutsideRead,
} from './types'

const dayOf = (event: RuleEventInput) =>
    event.occurredAt ?? event.scheduledAt ?? ''

/**
 * What every field read through a variable holds as the rules read it, by field id: an attribute from the enrolment, a
 * data element from the newest event with a value among those its variable reads (the stage's for a newest-in-stage
 * variable, those before the event for a previous-event one). For saying why outside the form; pure.
 */
export const outsideReads = (
    context: Pick<RuleContext, 'fieldVariables' | 'stageNames'>,
    { event, enrollment, otherEvents }: EventRuleInput
): Map<string, RuleOutsideRead> => {
    const newestFirst = [
        event,
        ...otherEvents.filter(({ id }) => id !== event.id),
    ].sort(
        (a, b) =>
            dayOf(b).localeCompare(dayOf(a)) ||
            (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
    )
    const reads = new Map<string, RuleOutsideRead>()
    for (const [fieldId, { variable, options }] of context.fieldVariables) {
        const base = {
            label: variable.fieldName ?? variable.name,
            valueType: variable.fieldValueType ?? variable.valueType ?? 'TEXT',
            options,
            variable: variable.name,
        }
        if (variable.attributeId !== undefined) {
            reads.set(fieldId, {
                ...base,
                value: enrollment?.attributes[fieldId],
                from: { kind: 'enrollment' },
            })
            continue
        }
        const read = newestFirst.filter((candidate) => {
            switch (variable.sourceType) {
                case 'DATAELEMENT_CURRENT_EVENT':
                    return candidate === event
                case 'DATAELEMENT_PREVIOUS_EVENT':
                    return dayOf(candidate) < dayOf(event)
                case 'DATAELEMENT_NEWEST_EVENT_PROGRAM_STAGE':
                    return candidate.programStageId === variable.programStageId
                default:
                    return true
            }
        })
        const source = read.find(
            ({ dataValues }) => dataValues[fieldId] !== undefined
        )
        reads.set(fieldId, {
            ...base,
            value: source?.dataValues[fieldId],
            from: {
                kind: 'event',
                stage: context.stageNames.get(
                    source?.programStageId ?? variable.programStageId ?? ''
                ),
                ...(variable.sourceType === 'DATAELEMENT_PREVIOUS_EVENT' && {
                    previous: true,
                }),
            },
        })
    }
    return reads
}
