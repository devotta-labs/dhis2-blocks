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
    evaluateEnrollmentRules,
    evaluateEventRules,
    evaluateEventsRules,
    explainField,
    expressionReferences,
    metadataForEnrollment,
    metadataForStage,
    rowsAffectedBy,
    scanExpression,
    loadRuleEngine,
    preloadRuleEngine,
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

export const evaluateLoaded = async (
    metadata: ProgramRulesMetadata,
    input: EventRuleInput
) => {
    const engine = await loadRuleEngine()
    const context = buildRuleContext(engine, metadata)
    return evaluateEventRules(engine, context, input)
}

export const startEngine = () => preloadRuleEngine()

export const whyHidden = (effects: RuleEffects, fieldId: string) =>
    (effects.hiddenFields.get(fieldId) ?? []).map(
        (by) => `${by.ruleName}: ${by.condition}`
    )
export const explainLmp = (effects: RuleEffects) =>
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

export const useEventRules = () =>
    useProgramRules({
        programId: 'WSGAb5XwJ3Y',
        programStageId: 'WZbXY0S00lP',
        enrollmentId: 'PE6abx7Zhn0',
        input: { event },
    })

export const useTwoEvaluations = () => {
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

export const referencedNames = (expression: string) =>
    expressionReferences(expression).map(({ name }) => name)
export const readsByKind = (expression: string) => scanExpression(expression)
export const writes = (action: Parameters<typeof assignedVariable>[0]) =>
    assignedVariable(action)

export const useStageGraph = () => {
    const { context } = useProgramRuleContext({
        programId: 'WSGAb5XwJ3Y',
        programStageId: 'WZbXY0S00lP',
    })
    return context?.graph
}

export const statuses: UseProgramRulesResult['status'][] = [
    'loading',
    'ready',
    'error',
]
// @ts-expect-error There is no idle status.
export const idle: UseProgramRulesResult['status'] = 'idle'

export const ruleQueryKey: readonly string[] = programRulesQueryKeys.all
export const metadataKey = programRulesQueryKeys.metadata('WSGAb5XwJ3Y')

export const evaluateGrid = async (
    metadata: ProgramRulesMetadata,
    input: EventsRuleInput,
    changed: { rowId: string; fieldId: string }
) => {
    const engine = await loadRuleEngine()
    const contexts = new Map(
        metadata.programStages.map<[string, RuleContext]>(({ id }) => [
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
    personsLoaded: true,
}

export const useGridRules = () => {
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
export const gridFailures = (evaluation: EventsRulesEvaluation) => [
    ...evaluation.failures.values(),
]
declare const gridEvaluation: EventsRulesEvaluation
// @ts-expect-error An evaluation holds the effects and the failures, not the effects alone.
export const gridEffectsOnly: Map<string, RuleEffects> = gridEvaluation
export const gridRules = (result: UseEventsRulesResult) => result.rules
export const gridInvalidRules = (rules: EventsRules) => rules.invalidRules
export const gridOptionGroups = (rules: EventsRules) => rules.optionGroupOptions
export const noEffects: RuleEffects = emptyEffects()
// @ts-expect-error The hook needs to know whether the program is a tracker program.
export const missingTrackerOption: UseEventsRulesOptions = {
    programId: 'WSGAb5XwJ3Y',
    programStageIds: [],
    enrollmentIds: [],
}

export const liveRow: EventsRuleRow = {
    event,
    enrollmentId: 'PE6abx7Zhn0',
    enrollment: loadedPerson.enrollment,
}
export const evaluatePerson = async (metadata: ProgramRulesMetadata) => {
    const engine = await loadRuleEngine()
    const context = buildRuleContext(engine, metadataForEnrollment(metadata))
    return evaluateEnrollmentRules(engine, context, {
        enrollment: loadedPerson.enrollment,
        events: [],
    })
}
export const usePersonRules = () => {
    const { rules } = useEventsRules({
        programId: 'WSGAb5XwJ3Y',
        programStageIds: [],
        tracker: true,
        enrollmentIds: ['PE6abx7Zhn0'],
        enrollments: true,
    })
    return (
        rules?.evaluateEnrollments?.([
            { enrollment: loadedPerson.enrollment, events: [] },
        ]).effects ?? new Map()
    )
}
