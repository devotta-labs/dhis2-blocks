import type * as Engine from '@dhis2/rule-engine'
import { Result } from 'better-result'
import {
    actionField,
    assignedVariable,
    buildDependencyGraph,
} from './dependencyGraph'
import type {
    Attribution,
    InvalidRule,
    ProgramRuleActionMetadata,
    ProgramRuleMetadata,
    ProgramRulesMetadata,
    ProgramRuleVariableMetadata,
    RuleContext,
    RuleEngineModule,
    RuleInfo,
} from './types'
import { ruleValueType } from './valueTypes'

const TYPE_CHECK_SUMMARY = /^\d+ error\(s\), \d+ warning\(s\)$/

const parseFailure = (validation: () => Engine.RuleValidationResult) => {
    const result = Result.try(validation)
    if (result.isErr()) {
        return undefined
    }
    const { valid, errorMessage } = result.value
    if (
        valid ||
        errorMessage == null ||
        TYPE_CHECK_SUMMARY.test(errorMessage)
    ) {
        return undefined
    }
    return errorMessage
}

const evaluationOrder = (rules: ReadonlyArray<ProgramRuleMetadata>) =>
    rules
        .map((rule, index) => ({ rule, index }))
        .sort(
            (a, b) =>
                (a.rule.priority ?? Infinity) - (b.rule.priority ?? Infinity) ||
                a.index - b.index
        )
        .map(({ rule }) => rule)

const validParts = (
    ruleEngine: Engine.RuleEngineJs,
    rules: ReadonlyArray<ProgramRuleMetadata>
) => {
    const store = new Map<string, Engine.DataItemJs>()
    const invalidRules: InvalidRule[] = []
    const valid: ProgramRuleMetadata[] = []
    for (const rule of rules) {
        const ruleName = rule.displayName ?? rule.name
        const conditionFailure = parseFailure(() =>
            ruleEngine.validate(rule.condition, store)
        )
        if (conditionFailure !== undefined) {
            invalidRules.push({
                ruleId: rule.id,
                ruleName,
                expression: rule.condition,
                message: conditionFailure,
            })
            continue
        }
        const actions = rule.actions.filter((action) => {
            const data = action.data
            const failure = data
                ? parseFailure(() =>
                      ruleEngine.validateDataFieldExpression(data, store)
                  )
                : undefined
            if (data && failure !== undefined) {
                invalidRules.push({
                    ruleId: rule.id,
                    ruleName,
                    actionId: action.id,
                    expression: data,
                    message: failure,
                })
            }
            return failure === undefined
        })
        valid.push({ ...rule, actions })
    }
    return { valid, invalidRules }
}

const attributeType = (action: ProgramRuleActionMetadata) => {
    if (action.dataElementId !== undefined) {
        return 'DATA_ELEMENT'
    }
    return action.attributeId !== undefined
        ? 'TRACKED_ENTITY_ATTRIBUTE'
        : 'UNKNOWN'
}

const optional: (
    key: string,
    value: string | undefined
) => [string, string][] = (key, value) => (value ? [[key, value]] : [])

const toEngineActions = (
    engine: RuleEngineModule,
    rule: ProgramRuleMetadata,
    variablesByName: Map<string, ProgramRuleVariableMetadata>
) =>
    rule.actions.flatMap((action) => {
        const base: [string, string][] = [
            ['id', action.id],
            ['ruleId', rule.id],
        ]
        const field = actionField(action)
        if (action.type === 'ASSIGN') {
            const name = assignedVariable(action)
            const variable =
                name === undefined ? undefined : variablesByName.get(name)
            const backing = variable?.dataElementId ?? variable?.attributeId
            const data = action.data ?? null
            return [
                ...(name === undefined || action.content === undefined
                    ? []
                    : [
                          new engine.RuleActionJs(
                              data,
                              'ASSIGN',
                              new Map([...base, ['content', action.content]]),
                              null
                          ),
                      ]),
                ...(field === undefined || field === backing
                    ? []
                    : [
                          new engine.RuleActionJs(
                              data,
                              'ASSIGN',
                              new Map([
                                  ...base,
                                  ['field', field],
                                  ['attributeType', attributeType(action)],
                              ]),
                              null
                          ),
                      ]),
            ]
        }
        return [
            new engine.RuleActionJs(
                action.data || null,
                action.type,
                new Map([
                    ...base,
                    ['attributeType', attributeType(action)],
                    ...optional('field', field),
                    ...optional('content', action.content),
                    ...optional('location', action.location),
                    ...optional('programStageSection', action.sectionId),
                    ...optional('programStage', action.programStageId),
                    ...optional('option', action.option?.id),
                    ...optional('optionGroup', action.optionGroup?.id),
                ]),
                null
            ),
        ]
    })

const toEngineVariable = (
    engine: RuleEngineModule,
    variable: ProgramRuleVariableMetadata,
    options: Map<string, Engine.Option[]>
) =>
    new engine.RuleVariableJs(
        Result.try(() =>
            engine.RuleVariableType.valueOf(variable.sourceType)
        ).unwrapOr(engine.RuleVariableType.CALCULATED_VALUE),
        variable.name,
        variable.useCodeForOptionSet,
        (variable.optionSetId && options.get(variable.optionSetId)) || [],
        variable.dataElementId ?? variable.attributeId ?? '',
        ruleValueType(engine, variable.fieldValueType ?? variable.valueType),
        variable.programStageId ?? null
    )

const toSupplementaryData = (
    engine: RuleEngineModule,
    metadata: ProgramRulesMetadata
) => {
    const groups = new Map<string, string[]>()
    for (const group of metadata.orgUnitGroups ?? []) {
        groups.set(group.id, [...group.orgUnitIds])
        if (group.code) {
            groups.set(group.code, [...group.orgUnitIds])
        }
    }
    return new engine.RuleSupplementaryDataJs(
        [...metadata.user.groupIds],
        [...metadata.user.roleIds],
        groups
    )
}

export const buildRuleContext: (
    engine: RuleEngineModule,
    metadata: ProgramRulesMetadata
) => RuleContext = (engine, metadata) => {
    const ruleEngine = new engine.RuleEngineJs(false)
    const variablesByName = new Map(
        metadata.variables.map((variable) => [variable.name, variable])
    )
    const { valid, invalidRules } = validParts(
        ruleEngine,
        evaluationOrder(metadata.rules)
    )
    const { graph, actionReads } = buildDependencyGraph(
        valid,
        metadata.variables
    )

    const ruleInfo = new Map<string, RuleInfo>()
    for (const rule of valid) {
        const ruleName = rule.displayName ?? rule.name
        const actions = new Map<string, Attribution>(
            rule.actions.map((action) => [
                action.id,
                {
                    ruleId: rule.id,
                    ruleName,
                    actionId: action.id,
                    condition: rule.condition,
                    readsFields: actionReads.get(action.id) ?? [],
                },
            ])
        )
        ruleInfo.set(rule.id, {
            id: rule.id,
            name: ruleName,
            condition: rule.condition,
            priority: rule.priority,
            programStageId: rule.programStageId,
            actions,
        })
    }

    const options = new Map(
        metadata.optionSets.map((optionSet) => [
            optionSet.id,
            optionSet.options.map(
                (option) => new engine.Option(option.name, option.code)
            ),
        ])
    )
    const rules = valid.map(
        (rule) =>
            new engine.RuleJs(
                rule.condition,
                toEngineActions(engine, rule, variablesByName),
                rule.id,
                rule.name,
                rule.programStageId ?? null,
                rule.priority ?? null
            )
    )
    const variables = metadata.variables.map((variable) =>
        toEngineVariable(engine, variable, options)
    )
    const constants = new Map(
        metadata.constants.map((constant) => [
            constant.id,
            String(constant.value),
        ])
    )
    const engineContext = new engine.RuleEngineContextJs(
        rules,
        variables,
        toSupplementaryData(engine, metadata),
        constants
    )
    const needs = ruleEngine.analyzeContextRequirements(rules, variables)

    const valueTypes = new Map<string, string>()
    for (const variable of metadata.variables) {
        const field = variable.dataElementId ?? variable.attributeId
        if (field !== undefined && variable.fieldValueType !== undefined) {
            valueTypes.set(field, variable.fieldValueType)
        }
    }
    const optionGroupOptions = new Map<string, Set<string>>()
    for (const action of valid.flatMap((rule) => rule.actions)) {
        if (action.optionGroup !== undefined) {
            optionGroupOptions.set(
                action.optionGroup.id,
                new Set(action.optionGroup.optionCodes)
            )
        }
    }

    return {
        programId: metadata.programId,
        programName: metadata.programName,
        rules,
        ruleInfo,
        actionMetadata: new Map(
            valid.flatMap((rule) =>
                rule.actions.map((action) => [action.id, action] as const)
            )
        ),
        graph,
        invalidRules,
        requirements: {
            enrollment: needs.needsEnrollment || needs.needsAttributes,
            otherEvents: needs.needsAllEvents,
            orgUnitGroups: [
                ...new Set(
                    [...graph.rules.values()].flatMap(
                        (dependencies) => dependencies.readsOrgUnitGroups
                    )
                ),
            ],
        },
        optionGroupOptions,
        stageNames: new Map(
            metadata.programStages.map((stage) => [stage.id, stage.name])
        ),
        valueTypes,
        engine: ruleEngine,
        engineContext,
    }
}
