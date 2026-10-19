import type { ProgramRulesClient } from './client'
import type {
    ProgramRuleActionMetadata,
    ProgramRuleMetadata,
    ProgramRulesMetadata,
    ProgramRuleVariableMetadata,
    RuleOptionSetMetadata,
    RuleOrgUnitGroupMetadata,
} from '../index'
import { z } from 'zod'

const RefSchema = z.object({ id: z.string() })

const ActionSchema = z.object({
    id: z.string(),
    programRuleActionType: z.string(),
    content: z.string().optional(),
    displayContent: z.string().optional(),
    data: z.string().optional(),
    location: z.string().optional(),
    dataElement: RefSchema.optional(),
    trackedEntityAttribute: RefSchema.optional(),
    programStageSection: RefSchema.optional(),
    programStage: RefSchema.optional(),
    option: z.object({ id: z.string(), code: z.string() }).optional(),
    optionGroup: z
        .object({
            id: z.string(),
            options: z.array(z.object({ code: z.string() })).default([]),
        })
        .optional(),
})

const RuleSchema = z.object({
    id: z.string(),
    name: z.string(),
    displayName: z.string().optional(),
    condition: z.string().default(''),
    priority: z.number().optional(),
    programStage: RefSchema.optional(),
    programRuleActions: z.array(ActionSchema),
})

const OptionSetSchema = z.object({
    id: z.string(),
    options: z.array(z.object({ code: z.string(), name: z.string() })),
})

const SourceFieldSchema = z.object({
    id: z.string(),
    valueType: z.string().optional(),
    optionSet: OptionSetSchema.optional(),
})

const VariableSchema = z.object({
    id: z.string(),
    name: z.string(),
    programRuleVariableSourceType: z.string(),
    useCodeForOptionSet: z.boolean().default(false),
    valueType: z.string().optional(),
    programStage: RefSchema.optional(),
    dataElement: SourceFieldSchema.optional(),
    trackedEntityAttribute: SourceFieldSchema.optional(),
})

export const ProgramRulesResponseSchema = z.object({
    rules: z.object({ programRules: z.array(RuleSchema) }),
    variables: z.object({ programRuleVariables: z.array(VariableSchema) }),
    constants: z.object({
        constants: z.array(
            z.object({
                id: z.string(),
                value: z.union([z.number(), z.string()]),
            })
        ),
    }),
    program: z.object({
        id: z.string(),
        name: z.string(),
        programStages: z.array(z.object({ id: z.string(), name: z.string() })),
    }),
    me: z.object({
        userRoles: z.array(RefSchema).default([]),
        userGroups: z.array(RefSchema).default([]),
    }),
})

export type ProgramRulesResponse = z.infer<typeof ProgramRulesResponseSchema>

const toAction = (
    action: z.infer<typeof ActionSchema>
): ProgramRuleActionMetadata => ({
    id: action.id,
    type: action.programRuleActionType,
    content: action.content,
    displayContent: action.displayContent,
    data: action.data,
    location: action.location,
    dataElementId: action.dataElement?.id,
    attributeId: action.trackedEntityAttribute?.id,
    sectionId: action.programStageSection?.id,
    programStageId: action.programStage?.id,
    option: action.option,
    optionGroup: action.optionGroup && {
        id: action.optionGroup.id,
        optionCodes: action.optionGroup.options.map((option) => option.code),
    },
})

const toRule = (rule: z.infer<typeof RuleSchema>): ProgramRuleMetadata => ({
    id: rule.id,
    name: rule.name,
    displayName: rule.displayName,
    condition: rule.condition,
    priority: rule.priority,
    programStageId: rule.programStage?.id,
    actions: rule.programRuleActions.map(toAction),
})

const toVariable = (
    variable: z.infer<typeof VariableSchema>
): ProgramRuleVariableMetadata => {
    const source = variable.dataElement ?? variable.trackedEntityAttribute
    return {
        id: variable.id,
        name: variable.name,
        sourceType: variable.programRuleVariableSourceType,
        useCodeForOptionSet: variable.useCodeForOptionSet,
        valueType: variable.valueType,
        dataElementId: variable.dataElement?.id,
        attributeId: variable.trackedEntityAttribute?.id,
        fieldValueType: source?.valueType,
        optionSetId: source?.optionSet?.id,
        programStageId: variable.programStage?.id,
    }
}

/** API responses → the lib's metadata. Option sets come nested in the variables. */
export const toProgramRulesMetadata = (
    response: ProgramRulesResponse
): ProgramRulesMetadata => {
    const optionSets = new Map<string, RuleOptionSetMetadata>()
    for (const variable of response.variables.programRuleVariables) {
        const optionSet = (
            variable.dataElement ?? variable.trackedEntityAttribute
        )?.optionSet
        if (optionSet !== undefined) {
            optionSets.set(optionSet.id, optionSet)
        }
    }
    return {
        programId: response.program.id,
        programName: response.program.name,
        programStages: response.program.programStages,
        rules: response.rules.programRules.map(toRule),
        variables: response.variables.programRuleVariables.map(toVariable),
        constants: response.constants.constants,
        optionSets: [...optionSets.values()],
        user: {
            roleIds: response.me.userRoles.map((role) => role.id),
            groupIds: response.me.userGroups.map((group) => group.id),
        },
    }
}

const ACTION_FIELDS =
    'id,programRuleActionType,content,displayContent,data,location,dataElement[id],trackedEntityAttribute[id],programStageSection[id],programStage[id],option[id,code],optionGroup[id,options[code]]'
const SOURCE_FIELD = 'id,valueType,optionSet[id,options[code,name]]'

export const fetchProgramRulesMetadata = async (
    client: ProgramRulesClient,
    programId: string,
    signal?: AbortSignal
): Promise<ProgramRulesMetadata> =>
    toProgramRulesMetadata(
        await client.query(
            {
                rules: {
                    resource: 'programRules',
                    params: {
                        filter: `program.id:eq:${programId}`,
                        paging: false,
                        fields: `id,name,displayName,condition,priority,programStage[id],programRuleActions[${ACTION_FIELDS}]`,
                    },
                },
                variables: {
                    resource: 'programRuleVariables',
                    params: {
                        filter: `program.id:eq:${programId}`,
                        paging: false,
                        fields: `id,name,programRuleVariableSourceType,useCodeForOptionSet,valueType,programStage[id],dataElement[${SOURCE_FIELD}],trackedEntityAttribute[${SOURCE_FIELD}]`,
                    },
                },
                constants: {
                    resource: 'constants',
                    params: { paging: false, fields: 'id,value' },
                },
                program: {
                    resource: 'programs',
                    id: programId,
                    params: { fields: 'id,name,programStages[id,name]' },
                },
                me: {
                    resource: 'me',
                    params: { fields: 'userRoles[id],userGroups[id]' },
                },
            },
            ProgramRulesResponseSchema,
            signal
        )
    )

const OrgUnitGroupsResponseSchema = z.object({
    groups: z.object({
        organisationUnitGroups: z.array(
            z.object({
                id: z.string(),
                code: z.string().optional(),
                organisationUnits: z.array(RefSchema).default([]),
            })
        ),
    }),
})

/** The groups `d2:inOrgUnitGroup` names (by id or code), with their members. */
export const fetchOrgUnitGroups = async (
    client: ProgramRulesClient,
    groups: ReadonlyArray<string>,
    signal?: AbortSignal
): Promise<RuleOrgUnitGroupMetadata[]> => {
    const list = `[${groups.join(',')}]`
    const response = await client.query(
        {
            groups: {
                resource: 'organisationUnitGroups',
                params: {
                    paging: false,
                    rootJunction: 'OR',
                    filter: [`id:in:${list}`, `code:in:${list}`],
                    fields: 'id,code,organisationUnits[id]',
                },
            },
        },
        OrgUnitGroupsResponseSchema,
        signal
    )
    return response.groups.organisationUnitGroups.map((group) => ({
        id: group.id,
        code: group.code,
        orgUnitIds: group.organisationUnits.map((orgUnit) => orgUnit.id),
    }))
}
