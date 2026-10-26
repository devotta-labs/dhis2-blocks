import type {
    Attribution,
    EventRuleInput,
    EventsRuleInput,
    EventsRuleRow,
    EventsRules,
    EventsRulesEvaluation,
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
    RuleEnrollmentData,
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
    UseEventsRulesOptions,
    UseEventsRulesResult,
    UseProgramRulesOptions,
    UseProgramRulesResult,
} from '../index'
import {
    assignedVariable,
    buildRuleContext,
    crossEventFields,
    emptyEffects,
    evaluateEventRules,
    evaluateEventsRules,
    explainField,
    expressionReferences,
    metadataForStage,
    rowsAffectedBy,
    scanExpression,
    loadRuleEngine,
    programRulesQueryKeys,
    useEventsRules,
    useProgramRuleContext,
    useProgramRuleEvaluator,
    useProgramRules,
} from '../index'

export type SupportedProgramRulesTypes = [
    Attribution,
    EventRuleInput,
    EventsRuleInput,
    EventsRuleRow,
    EventsRules,
    EventsRulesEvaluation,
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
    RuleEnrollmentData,
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
    UseEventsRulesOptions,
    UseEventsRulesResult,
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

// A grid evaluates many rows at once, on its live values; a person's other rows re-run when a field they read changes.
export const evaluateGrid = async (
    metadata: ProgramRulesMetadata,
    input: EventsRuleInput,
    changed: { rowId: string; fieldId: string }
): Promise<EventsRulesEvaluation> => {
    const engine = await loadRuleEngine()
    const contexts = new Map(
        metadata.programStages.map(({ id }): [string, RuleContext] => [
            id,
            buildRuleContext(engine, metadataForStage(metadata, id)),
        ])
    )
    const rowIds = rowsAffectedBy(
        input.rows,
        crossEventFields(metadata),
        changed.rowId,
        changed.fieldId
    )
    return evaluateEventsRules(engine, contexts, input, rowIds)
}
export const loadedPerson: RuleEnrollmentData = {
    enrollment: {
        id: 'PE6abx7Zhn0',
        enrolledAt: '2026-03-01',
        orgUnitId: 'm7fBMpmVpSM',
        attributes: {},
    },
    events: [event],
}
// @ts-expect-error A row needs its event.
export const eventlessRow: EventsRuleRow = { enrollmentId: 'PE6abx7Zhn0' }
// @ts-expect-error The input says whether the rows belong to a tracker program.
export const missingTracker: EventsRuleInput = {
    rows: [],
    persons: new Map(),
}

// A grid hands the hook its stages and people; the rules evaluate its rows and name the rows an edit affects.
export const useGridRules = (): Map<string, RuleEffects> => {
    const { rules } = useEventsRules({
        programId: 'WSGAb5XwJ3Y',
        programStageIds: ['WZbXY0S00lP'],
        tracker: true,
        enrollmentIds: ['PE6abx7Zhn0'],
    })
    const rows: EventsRuleRow[] = [{ event, enrollmentId: 'PE6abx7Zhn0' }]
    const affected = rules?.rowsAffectedBy(rows, event.id, 'w4ky6EkVahL') ?? [
        event.id,
    ]
    return rules?.evaluate(rows, affected).effects ?? new Map()
}
// A row the engine failed on is in `failures`, never in `effects`.
export const gridFailures = (evaluation: EventsRulesEvaluation): Error[] => [
    ...evaluation.failures.values(),
]
declare const gridEvaluation: EventsRulesEvaluation
// @ts-expect-error An evaluation holds the effects and the failures, not the effects alone.
export const gridEffectsOnly: Map<string, RuleEffects> = gridEvaluation
export const gridRules = (
    result: UseEventsRulesResult
): EventsRules | undefined => result.rules
export const gridInvalidRules = (rules: EventsRules): InvalidRule[] =>
    rules.invalidRules
// The option codes of the groups that rows' option group effects name, across every stage.
export const gridOptionGroups = (
    rules: EventsRules
): Map<string, Set<string>> => rules.optionGroupOptions
// A row the rules do not act on.
export const noEffects: RuleEffects = emptyEffects()
// @ts-expect-error The hook needs to know whether the program is a tracker program.
export const missingTrackerOption: UseEventsRulesOptions = {
    programId: 'WSGAb5XwJ3Y',
    programStageIds: [],
    enrollmentIds: [],
}
