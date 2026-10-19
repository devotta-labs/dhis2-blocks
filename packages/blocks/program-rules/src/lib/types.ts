import type * as Engine from '@dhis2/rule-engine'

/** The `@dhis2/rule-engine` module. Callers load it (lazily) and pass it in. */
export type RuleEngineModule = typeof Engine

// ---- Metadata: what a rule context is built from --------------------------

export interface ProgramRuleActionMetadata {
    id: string
    /** `programRuleActionType`, e.g. `HIDEFIELD` or `ASSIGN`. */
    type: string
    /** Raw content: the message source, or `#{var}` for an ASSIGN. */
    content?: string
    /** Translated content, used for message and display texts. */
    displayContent?: string
    data?: string
    location?: string
    dataElementId?: string
    attributeId?: string
    sectionId?: string
    programStageId?: string
    option?: { id: string; code: string }
    optionGroup?: { id: string; optionCodes: ReadonlyArray<string> }
}

export interface ProgramRuleMetadata {
    id: string
    name: string
    displayName?: string
    condition: string
    priority?: number
    programStageId?: string
    actions: ReadonlyArray<ProgramRuleActionMetadata>
}

export interface ProgramRuleVariableMetadata {
    id: string
    /** The untranslated name that expressions reference. */
    name: string
    /** `programRuleVariableSourceType`, e.g. `DATAELEMENT_CURRENT_EVENT`. */
    sourceType: string
    useCodeForOptionSet: boolean
    /** The variable's own value type (used for calculated values). */
    valueType?: string
    dataElementId?: string
    attributeId?: string
    /** Value type of the backing data element or attribute. */
    fieldValueType?: string
    optionSetId?: string
    programStageId?: string
}

export interface RuleOptionSetMetadata {
    id: string
    options: ReadonlyArray<{ code: string; name: string }>
}

export interface RuleOrgUnitGroupMetadata {
    id: string
    code?: string
    orgUnitIds: ReadonlyArray<string>
}

export interface ProgramRulesMetadata {
    programId: string
    programName: string
    programStages: ReadonlyArray<{ id: string; name: string }>
    rules: ReadonlyArray<ProgramRuleMetadata>
    variables: ReadonlyArray<ProgramRuleVariableMetadata>
    constants: ReadonlyArray<{ id: string; value: number | string }>
    optionSets: ReadonlyArray<RuleOptionSetMetadata>
    user: { roleIds: ReadonlyArray<string>; groupIds: ReadonlyArray<string> }
    /** Groups referenced by `d2:inOrgUnitGroup`, with their members. */
    orgUnitGroups?: ReadonlyArray<RuleOrgUnitGroupMetadata>
}

// ---- Input: what one evaluation runs on ------------------------------------

export type RuleEventStatus =
    | 'ACTIVE'
    | 'COMPLETED'
    | 'SCHEDULE'
    | 'SKIPPED'
    | 'VISITED'
    | 'OVERDUE'

export type RuleEnrollmentStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED'

/** An event, values in tracker API format, empty values omitted. */
export interface RuleEventInput {
    id: string
    programStageId: string
    occurredAt?: string
    scheduledAt?: string
    createdAt?: string
    completedAt?: string
    orgUnitId: string
    orgUnitCode?: string
    status: RuleEventStatus
    /** dataElementId → value */
    dataValues: Record<string, string>
}

export interface RuleEnrollmentInput {
    id: string
    enrolledAt: string
    occurredAt?: string
    orgUnitId: string
    orgUnitCode?: string
    status?: RuleEnrollmentStatus
    /** attributeId → value */
    attributes: Record<string, string>
}

export interface EventRuleInput {
    event: RuleEventInput
    enrollment?: RuleEnrollmentInput
    /** The enrollment's other events. The current event is ignored if present. */
    otherEvents: ReadonlyArray<RuleEventInput>
}

// ---- Output: effects -------------------------------------------------------

/** Which rule action caused an effect, and which answers fed it. */
export interface Attribution {
    ruleId: string
    ruleName: string
    actionId: string
    condition: string
    /** Fields read by the condition and the action, through variables and earlier ASSIGNs. */
    readsFields: string[]
}

export interface RuleMessage {
    kind: 'error' | 'warning' | 'errorOnComplete' | 'warningOnComplete'
    text: string
    by: Attribution
}

export interface RuleDisplayItem {
    location: 'feedback' | 'indicators'
    /** The action's content (the key of a key-value pair). */
    label: string
    /** The evaluated data expression, `''` when there is none. */
    value: string
    by: Attribution
}

export interface RuleAssignedValue {
    value: string | null
    by: Attribution
}

export interface RuleOptionGroupEffects {
    hidden: Set<string>
    shown: Set<string>
}

export interface RuleEffects {
    hiddenFields: Map<string, Attribution[]>
    hiddenSections: Map<string, Attribution[]>
    mandatoryFields: Map<string, Attribution[]>
    assignedValues: Map<string, RuleAssignedValue>
    /** Keyed by field id, or `'form'` for messages without a field. */
    messages: Map<string, RuleMessage[]>
    /** fieldId → hidden option codes */
    hiddenOptions: Map<string, Set<string>>
    /** fieldId → hidden and shown option group ids */
    optionGroups: Map<string, RuleOptionGroupEffects>
    /** fieldId → the rule actions behind its hiddenOptions and optionGroups entries */
    optionAttributions: Map<string, Attribution[]>
    displayTexts: RuleDisplayItem[]
    keyValuePairs: RuleDisplayItem[]
    hiddenProgramStages: Set<string>
    /** programStageId → the rule actions that hid it */
    programStageAttributions: Map<string, Attribution[]>
}

// ---- Context ---------------------------------------------------------------

/** A rule, or one of its actions, that the engine cannot parse. It is left out of evaluation. */
export interface InvalidRule {
    ruleId: string
    ruleName: string
    /** Set when only this action's data expression is invalid. */
    actionId?: string
    expression: string
    message: string
}

export interface RuleDependencies {
    readsVariables: string[]
    readsProgramVariables: string[]
    readsConstants: string[]
    readsOrgUnitGroups: string[]
    /** Transitive, through variables and ASSIGNs evaluated earlier. */
    readsFields: string[]
    writesFields: string[]
    writesVariables: string[]
    writesSections: string[]
    writesProgramStages: string[]
}

export interface RuleDependencyGraph {
    /** In evaluation order: priority ascending, rules without priority last. */
    rules: Map<string, RuleDependencies>
    /** fieldId → ids of rules that read it */
    fieldReaders: Map<string, string[]>
    /** fieldId → ids of rules that write it */
    fieldWriters: Map<string, string[]>
}

export interface RuleContextRequirements {
    /** The rules read enrollment data or attributes. */
    enrollment: boolean
    /** The rules read the enrollment's other events. */
    otherEvents: boolean
    /** Group ids or codes referenced by `d2:inOrgUnitGroup`. */
    orgUnitGroups: string[]
}

export interface RuleInfo {
    id: string
    name: string
    condition: string
    priority?: number
    programStageId?: string
    /** actionId → the attribution every effect of that action carries */
    actions: Map<string, Attribution>
}

export interface RuleContext {
    programId: string
    programName: string
    /** Converted rules, invalid ones and invalid actions removed. */
    rules: ReadonlyArray<Engine.RuleJs>
    ruleInfo: Map<string, RuleInfo>
    /** actionId → the action's metadata, for effect text and option codes */
    actionMetadata: Map<string, ProgramRuleActionMetadata>
    graph: RuleDependencyGraph
    invalidRules: InvalidRule[]
    requirements: RuleContextRequirements
    /** optionGroupId → option codes */
    optionGroupOptions: Map<string, Set<string>>
    /** programStageId → name */
    stageNames: Map<string, string>
    /** fieldId → value type, for fields read through variables */
    valueTypes: Map<string, string>
    engine: Engine.RuleEngineJs
    engineContext: Engine.RuleEngineContextJs
}
