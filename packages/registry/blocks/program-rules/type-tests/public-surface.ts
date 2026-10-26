import type {
    Attribution,
    EventRuleInput,
    InvalidRule,
    ProgramRuleActionMetadata,
    ProgramRuleMetadata,
    ProgramRulesMetadata,
    ProgramRuleVariableMetadata,
    RuleAssignedValue,
    RuleContext,
    RuleContextRequirements,
    RuleDependencies,
    RuleDependencyGraph,
    RuleDisplayItem,
    RuleEffects,
    RuleEngineModule,
    RuleEnrollmentInput,
    RuleEnrollmentStatus,
    RuleEventInput,
    RuleEventStatus,
    RuleInfo,
    RuleMessage,
    RuleOptionGroupEffects,
    RuleOptionSetMetadata,
    RuleOrgUnitGroupMetadata,
    ExpressionReference,
    ExpressionReferences,
    ProgramRulesInput,
    ProgramRulesStatus,
    RuleEnrollmentInput as HookEnrollmentInput,
    RuleEvaluation,
    UseProgramRuleEvaluatorOptions,
    UseProgramRuleEvaluatorResult,
    UseProgramRuleContextOptions,
    UseProgramRuleContextResult,
    UseProgramRulesOptions,
    UseProgramRulesResult,
} from '../index'
import {
    assignedVariable,
    buildRuleContext,
    evaluateEventRules,
    explainField,
    expressionReferences,
    scanExpression,
    loadRuleEngine,
    programRulesQueryKeys,
    useProgramRuleContext,
    useProgramRuleEvaluator,
    useProgramRules,
} from '../index'

export type SupportedProgramRulesTypes = [
    Attribution,
    EventRuleInput,
    InvalidRule,
    ProgramRuleActionMetadata,
    ProgramRuleMetadata,
    ProgramRulesMetadata,
    ProgramRuleVariableMetadata,
    RuleAssignedValue,
    RuleContext,
    RuleContextRequirements,
    RuleDependencies,
    RuleDependencyGraph,
    RuleDisplayItem,
    RuleEffects,
    RuleEngineModule,
    RuleEnrollmentInput,
    RuleEnrollmentStatus,
    RuleEventInput,
    RuleEventStatus,
    RuleInfo,
    RuleMessage,
    RuleOptionGroupEffects,
    RuleOptionSetMetadata,
    RuleOrgUnitGroupMetadata,
    ProgramRulesInput,
    ProgramRulesStatus,
    RuleEvaluation,
    UseProgramRuleEvaluatorOptions,
    UseProgramRuleEvaluatorResult,
    UseProgramRuleContextOptions,
    UseProgramRuleContextResult,
    UseProgramRulesOptions,
    UseProgramRulesResult,
    ExpressionReference,
    HookEnrollmentInput,
]

// The lib is engine-in, effects-out.
export const evaluateLoaded = async (
    metadata: ProgramRulesMetadata,
    input: EventRuleInput
): Promise<RuleEffects> => {
    const engine = await loadRuleEngine()
    const context = buildRuleContext(engine, metadata)
    return evaluateEventRules(engine, context, input)
}

// The effect maps carry attributions the form can show.
export const whyHidden = (effects: RuleEffects, fieldId: string): string[] =>
    (effects.hiddenFields.get(fieldId) ?? []).map(
        (by) => `${by.ruleName}: ${by.condition}`
    )
export const explainLmp = (effects: RuleEffects): Attribution[] =>
    explainField(effects, 'w4ky6EkVahL')
export const messageKinds: RuleMessage['kind'][] = [
    'error',
    'warning',
    'errorOnComplete',
    'warningOnComplete',
]

const event: RuleEventInput = {
    id: 'Evahwp3zrQ4',
    programStageId: 'WZbXY0S00lP',
    orgUnitId: 'm7fBMpmVpSM',
    status: 'ACTIVE',
    dataValues: { w4ky6EkVahL: '2026-01-01' },
}
export const hostInput: EventRuleInput = { event, otherEvents: [] }

const { programStageId: _stage, ...stageless } = event
// @ts-expect-error The event needs its program stage.
export const missingStage: RuleEventInput = stageless

// @ts-expect-error The lib's input always lists the other events.
export const missingOtherEvents: EventRuleInput = { event }

// The hook fetches the enrollment and its events when they are not passed.
export const useEventRules = (): UseProgramRulesResult =>
    useProgramRules({
        programId: 'WSGAb5XwJ3Y',
        programStageId: 'WZbXY0S00lP',
        enrollmentId: 'PE6abx7Zhn0',
        input: { event },
    })

// One context evaluates any number of events; each result is a Result.
export const useTwoEvaluations = (): RuleEffects[] => {
    const { evaluate } = useProgramRuleEvaluator({
        programId: 'WSGAb5XwJ3Y',
        programStageId: 'WZbXY0S00lP',
        enrollmentId: 'PE6abx7Zhn0',
    })
    if (evaluate === undefined) {
        return []
    }
    return [evaluate(event), evaluate({ ...event, dataValues: {} })].flatMap(
        (evaluation) => (evaluation.isOk() ? [evaluation.value] : [])
    )
}
declare const evaluation: RuleEvaluation
// @ts-expect-error An evaluation is a Result, not the effects themselves.
export const unwrapped: RuleEffects = evaluation

// The references an expression reads, with where they are, for displays.
export const referencedNames = (expression: string): string[] =>
    expressionReferences(expression).map(({ name }) => name)
// The references grouped by kind.
export const readsByKind = (expression: string): ExpressionReferences =>
    scanExpression(expression)
export const writes = (
    action: Parameters<typeof assignedVariable>[0]
): string | undefined => assignedVariable(action)

// The graph, invalid rules and requirements need no event.
export const useStageGraph = (): RuleDependencyGraph | undefined =>
    useProgramRuleContext({
        programId: 'WSGAb5XwJ3Y',
        programStageId: 'WZbXY0S00lP',
    }).context?.graph

export const statuses: UseProgramRulesResult['status'][] = [
    'loading',
    'ready',
    'error',
]
// @ts-expect-error There is no idle status.
export const idle: UseProgramRulesResult['status'] = 'idle'

// Hosts invalidate rule data with the exported keys.
export const ruleQueryKey: readonly string[] = programRulesQueryKeys.all
export const metadataKey = programRulesQueryKeys.metadata('WSGAb5XwJ3Y')
