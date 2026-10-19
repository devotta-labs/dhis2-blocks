import { scanExpression, type ExpressionReferences } from './scanExpression'
import type {
    ProgramRuleActionMetadata,
    ProgramRuleMetadata,
    ProgramRuleVariableMetadata,
    RuleDependencies,
    RuleDependencyGraph,
} from './types'

/** `#{name}` or `A{name}` as a whole ASSIGN content: the variable it writes. */
const ASSIGNED_VARIABLE = /^\s*[#A]\{([^{}]+)\}\s*$/

export const assignedVariable = (
    action: ProgramRuleActionMetadata
): string | undefined =>
    action.type === 'ASSIGN'
        ? action.content?.match(ASSIGNED_VARIABLE)?.[1]?.trim()
        : undefined

export const actionField = (
    action: ProgramRuleActionMetadata
): string | undefined => action.dataElementId ?? action.attributeId

const variableField = (variable: ProgramRuleVariableMetadata | undefined) =>
    variable?.dataElementId ?? variable?.attributeId

const union = (lists: ReadonlyArray<ReadonlyArray<string>>): string[] => [
    ...new Set(lists.flat()),
]

const addTo = (index: Map<string, string[]>, key: string, ruleId: string) => {
    const list = index.get(key) ?? []
    if (!list.includes(ruleId)) {
        list.push(ruleId)
    }
    index.set(key, list)
}

export interface DependencyGraphResult {
    graph: RuleDependencyGraph
    /** actionId → fields its condition and data read, transitively */
    actionReads: Map<string, string[]>
}

/**
 * `rules` must be in evaluation order. The engine evaluates in one pass, so
 * an ASSIGN only feeds the rules after it: a variable's upstream fields are
 * the ones known when the reading rule runs.
 */
export const buildDependencyGraph = (
    rules: ReadonlyArray<ProgramRuleMetadata>,
    variables: ReadonlyArray<ProgramRuleVariableMetadata>
): DependencyGraphResult => {
    const variablesByName = new Map(
        variables.map((variable) => [variable.name, variable])
    )
    // variable name → fields that feed it through ASSIGNs evaluated so far
    const upstream = new Map<string, Set<string>>()
    const fieldsRead = (references: ExpressionReferences): string[] =>
        union(
            references.variables.map((name) => {
                const field = variableField(variablesByName.get(name))
                return [
                    ...(field === undefined ? [] : [field]),
                    ...(upstream.get(name) ?? []),
                ]
            })
        )

    const graph: RuleDependencyGraph = {
        rules: new Map(),
        fieldReaders: new Map(),
        fieldWriters: new Map(),
    }
    const actionReads = new Map<string, string[]>()

    for (const rule of rules) {
        const condition = scanExpression(rule.condition)
        const conditionFields = fieldsRead(condition)
        const actions = rule.actions.map((action) => {
            const references = scanExpression(action.data ?? '')
            const fields = union([conditionFields, fieldsRead(references)])
            actionReads.set(action.id, fields)
            return { action, references, fields }
        })
        const all = [condition, ...actions.map((entry) => entry.references)]
        const writesVariables = union(
            rule.actions.map((action) => {
                const name = assignedVariable(action)
                return name === undefined ? [] : [name]
            })
        )
        const dependencies: RuleDependencies = {
            readsVariables: union(all.map((refs) => refs.variables)),
            readsProgramVariables: union(
                all.map((refs) => refs.programVariables)
            ),
            readsConstants: union(all.map((refs) => refs.constants)),
            readsOrgUnitGroups: union(all.map((refs) => refs.orgUnitGroups)),
            readsFields: union([
                conditionFields,
                ...actions.map((entry) => entry.fields),
            ]),
            writesFields: union(
                rule.actions.map((action) => {
                    const assigned = assignedVariable(action)
                    const backing =
                        assigned === undefined
                            ? undefined
                            : variableField(variablesByName.get(assigned))
                    return [actionField(action), backing].filter(
                        (field): field is string => field !== undefined
                    )
                })
            ),
            writesVariables,
            writesSections: union(
                rule.actions.map((action) =>
                    action.type === 'HIDESECTION' &&
                    action.sectionId !== undefined
                        ? [action.sectionId]
                        : []
                )
            ),
            writesProgramStages: union(
                rule.actions.map((action) =>
                    action.type === 'HIDEPROGRAMSTAGE' &&
                    action.programStageId !== undefined
                        ? [action.programStageId]
                        : []
                )
            ),
        }
        graph.rules.set(rule.id, dependencies)
        for (const field of dependencies.readsFields) {
            addTo(graph.fieldReaders, field, rule.id)
        }
        for (const field of dependencies.writesFields) {
            addTo(graph.fieldWriters, field, rule.id)
        }
        for (const { action, fields } of actions) {
            const name = assignedVariable(action)
            if (name !== undefined) {
                upstream.set(
                    name,
                    new Set([...(upstream.get(name) ?? []), ...fields])
                )
            }
        }
    }
    return { graph, actionReads }
}
