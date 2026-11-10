import type {
    EventRuleInput,
    ProgramRuleMetadata,
    ProgramRulesMetadata,
    ProgramRuleVariableMetadata,
} from '../lib/types'

/** A small program for synthetic rule tests. */
export const programMetadata = (
    overrides: Partial<ProgramRulesMetadata> = {}
): ProgramRulesMetadata => ({
    programId: 'program',
    programName: 'Program',
    programStages: [{ id: 'stage', name: 'Stage' }],
    rules: [],
    variables: [],
    constants: [],
    optionSets: [],
    user: { roleIds: [], groupIds: [] },
    ...overrides,
})

export const currentEventVariable = (
    name: string,
    dataElementId: string,
    overrides: Partial<ProgramRuleVariableMetadata> = {}
): ProgramRuleVariableMetadata => ({
    id: `var_${name}`,
    name,
    sourceType: 'DATAELEMENT_CURRENT_EVENT',
    useCodeForOptionSet: false,
    dataElementId,
    fieldValueType: 'TEXT',
    ...overrides,
})

export const rule = (
    id: string,
    condition: string,
    actions: ProgramRuleMetadata['actions'],
    overrides: Partial<ProgramRuleMetadata> = {}
): ProgramRuleMetadata => ({
    id,
    name: `rule ${id}`,
    condition,
    actions,
    ...overrides,
})

export const eventInput = (
    dataValues: Record<string, string> = {},
    orgUnitId = 'ou'
): EventRuleInput => ({
    event: {
        id: 'event',
        programStageId: 'stage',
        occurredAt: '2026-03-12',
        orgUnitId,
        status: 'ACTIVE',
        dataValues,
    },
    otherEvents: [],
})
