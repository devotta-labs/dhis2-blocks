import type {
    Attribution,
    EventRuleInput,
    RuleContext,
    RuleEffects,
    RuleEngineModule,
} from './types'

export const evaluateEventRules = (
    engine: RuleEngineModule,
    context: RuleContext,
    input: EventRuleInput
): RuleEffects => {
    throw new Error(
        `not implemented: ${String(engine)} ${context.programId} ${input.event.id}`
    )
}

export const explainField = (
    effects: RuleEffects,
    fieldId: string
): Attribution[] => {
    throw new Error(`not implemented: ${effects.hiddenFields.size} ${fieldId}`)
}
