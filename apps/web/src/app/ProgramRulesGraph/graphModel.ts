import type {
    ProgramRuleActionMetadata,
    ProgramRulesMetadata,
    ProgramRuleVariableMetadata,
    RuleContext,
} from '@/registry/program-rules/index'

export type GraphNode =
    | {
          kind: 'rule'
          id: string
          ruleId: string
          name: string
          /** 1-based position in evaluation order. */
          order: number
          priority?: number
          /** Action types with no node to point at (texts, form messages). */
          effects: string[]
      }
    | {
          kind: 'field'
          id: string
          fieldId: string
          label: string
          /** Names of the program rule variables backed by this field. */
          variables: string[]
      }
    | { kind: 'variable'; id: string; name: string }
    | { kind: 'section' | 'stage'; id: string; targetId: string; label: string }

export interface GraphEdge {
    id: string
    source: string
    target: string
    /** `read`: an input of the rule. `write`: an action of the rule targets it. */
    kind: 'read' | 'write'
    actionTypes: string[]
}

export interface RulesGraphModel {
    /** Rules first, in evaluation order. */
    nodes: GraphNode[]
    edges: GraphEdge[]
}

export interface GraphLabels {
    /** Data element and attribute names by id. */
    fields: Map<string, string>
    /** Section names by id. */
    sections: Map<string, string>
}

export const ruleNodeId = (ruleId: string) => `rule:${ruleId}`
export const fieldNodeId = (fieldId: string) => `field:${fieldId}`
const variableNodeId = (name: string) => `variable:${name}`

/** `#{name}` or `A{name}` as a whole ASSIGN content: the variable it writes. */
const ASSIGNED_VARIABLE = /^\s*[#A]\{([^{}]+)\}\s*$/

export const assignedVariable = (action: ProgramRuleActionMetadata) =>
    action.type === 'ASSIGN'
        ? action.content?.match(ASSIGNED_VARIABLE)?.[1]?.trim()
        : undefined

const variableField = (variable: ProgramRuleVariableMetadata | undefined) =>
    variable?.dataElementId ?? variable?.attributeId

const MESSAGE_TYPES = new Set([
    'SHOWWARNING',
    'SHOWERROR',
    'WARNINGONCOMPLETE',
    'ERRORONCOMPLETE',
])

/** Messages don't change a field, so they end a chain rather than continue it. */
const propagates = (edge: GraphEdge) =>
    edge.kind === 'read' ||
    edge.actionTypes.some((type) => !MESSAGE_TYPES.has(type))

/** The actions of a rule that survived validation, in metadata order. */
export const ruleActions = (
    context: Pick<RuleContext, 'ruleInfo' | 'actionMetadata'>,
    ruleId: string
): ProgramRuleActionMetadata[] =>
    [...(context.ruleInfo.get(ruleId)?.actions.keys() ?? [])].flatMap(
        (actionId) => {
            const action = context.actionMetadata.get(actionId)
            return action === undefined ? [] : [action]
        }
    )

/**
 * Nodes and edges for the dependency graph of one stage's rules. Reads are
 * direct (the fields behind the variables a rule names, or a calculated
 * variable an earlier rule assigns), so an ASSIGN chain shows as a chain.
 * The graph's own `readsFields` are transitive; the details panel lists them.
 */
export const buildRulesGraphModel = (
    context: Pick<RuleContext, 'graph' | 'ruleInfo' | 'actionMetadata'>,
    metadata: Pick<ProgramRulesMetadata, 'variables' | 'programStages'>,
    labels: GraphLabels
): RulesGraphModel => {
    const variablesByName = new Map(
        metadata.variables.map((variable) => [variable.name, variable])
    )
    const variablesByField = new Map<string, string[]>()
    for (const variable of metadata.variables) {
        const field = variableField(variable)
        if (field !== undefined) {
            variablesByField.set(field, [
                ...(variablesByField.get(field) ?? []),
                variable.name,
            ])
        }
    }
    const stageNames = new Map(
        metadata.programStages.map((stage) => [stage.id, stage.name])
    )
    const nodes = new Map<string, GraphNode>()
    const edges = new Map<string, GraphEdge>()

    const fieldNode = (fieldId: string) => {
        const id = fieldNodeId(fieldId)
        if (!nodes.has(id)) {
            const variables = variablesByField.get(fieldId) ?? []
            nodes.set(id, {
                kind: 'field',
                id,
                fieldId,
                label: labels.fields.get(fieldId) ?? variables[0] ?? fieldId,
                variables,
            })
        }
        return id
    }
    const variableNode = (name: string) => {
        const id = variableNodeId(name)
        if (!nodes.has(id)) {
            nodes.set(id, { kind: 'variable', id, name })
        }
        return id
    }
    const targetNode = (kind: 'section' | 'stage', targetId: string) => {
        const id = `${kind}:${targetId}`
        if (!nodes.has(id)) {
            const names = kind === 'section' ? labels.sections : stageNames
            nodes.set(id, {
                kind,
                id,
                targetId,
                label: names.get(targetId) ?? targetId,
            })
        }
        return id
    }
    const connect = (
        source: string,
        target: string,
        kind: GraphEdge['kind'],
        actionType?: string
    ) => {
        const id = `${kind}:${source}->${target}`
        const edge = edges.get(id) ?? {
            id,
            source,
            target,
            kind,
            actionTypes: [],
        }
        if (
            actionType !== undefined &&
            !edge.actionTypes.includes(actionType)
        ) {
            edge.actionTypes.push(actionType)
        }
        edges.set(id, edge)
    }

    // Calculated variables (no backing field) only matter when a rule assigns them.
    const assignedCalculated = new Set(
        [...context.graph.rules.values()].flatMap((dependencies) =>
            dependencies.writesVariables.filter(
                (name) => variableField(variablesByName.get(name)) === undefined
            )
        )
    )

    let order = 0
    for (const [ruleId, dependencies] of context.graph.rules) {
        const info = context.ruleInfo.get(ruleId)
        const id = ruleNodeId(ruleId)
        const effects: string[] = []
        nodes.set(id, {
            kind: 'rule',
            id,
            ruleId,
            name: info?.name ?? ruleId,
            order: (order += 1),
            priority: info?.priority,
            effects,
        })

        for (const name of dependencies.readsVariables) {
            const field = variableField(variablesByName.get(name))
            if (field !== undefined) {
                connect(fieldNode(field), id, 'read')
            } else if (assignedCalculated.has(name)) {
                connect(variableNode(name), id, 'read')
            }
        }

        for (const action of ruleActions(context, ruleId)) {
            const targets: string[] = []
            const field = action.dataElementId ?? action.attributeId
            if (field !== undefined) {
                targets.push(fieldNode(field))
            }
            const assigned = assignedVariable(action)
            if (assigned !== undefined) {
                const backing = variableField(variablesByName.get(assigned))
                targets.push(
                    backing === undefined
                        ? variableNode(assigned)
                        : fieldNode(backing)
                )
            }
            if (action.type === 'HIDESECTION' && action.sectionId) {
                targets.push(targetNode('section', action.sectionId))
            }
            if (action.type === 'HIDEPROGRAMSTAGE' && action.programStageId) {
                targets.push(targetNode('stage', action.programStageId))
            }
            for (const target of new Set(targets)) {
                connect(id, target, 'write', action.type)
            }
            if (targets.length === 0 && !effects.includes(action.type)) {
                effects.push(action.type)
            }
        }
    }

    return { nodes: [...nodes.values()], edges: [...edges.values()] }
}

/**
 * Rules that read a field and only message on it (a check of their own
 * input): read edge id → the message edge back to the field. Drawn as one
 * two-way edge, and left out of the layout so the field stays left of the rule.
 */
export const checkLoops = (model: RulesGraphModel): Map<string, GraphEdge> => {
    const reads = new Map(
        model.edges
            .filter((edge) => edge.kind === 'read')
            .map((edge) => [`${edge.source}->${edge.target}`, edge.id])
    )
    const loops = new Map<string, GraphEdge>()
    for (const edge of model.edges) {
        const read = reads.get(`${edge.target}->${edge.source}`)
        if (edge.kind === 'write' && !propagates(edge) && read !== undefined) {
            loops.set(read, edge)
        }
    }
    return loops
}

export interface NodeChain {
    nodes: Set<string>
    edges: Set<string>
}

/**
 * The node, its neighbours, and the chains through it: upstream and
 * downstream along edges that carry a value or visibility on. A message
 * ends a chain downstream and is no cause upstream.
 */
export const connectedChain = (
    model: RulesGraphModel,
    nodeId: string
): NodeChain => {
    const nodes = new Set([nodeId])
    const chainEdges = new Set<string>()
    const walk = (direction: 'downstream' | 'upstream') => {
        const queue = [nodeId]
        const seen = new Set(queue)
        while (queue.length > 0) {
            const current = queue.shift()
            for (const edge of model.edges) {
                const [from, to] =
                    direction === 'downstream'
                        ? [edge.source, edge.target]
                        : [edge.target, edge.source]
                // Upstream of a neighbour, a message is not a cause.
                if (
                    from !== current ||
                    (direction === 'upstream' &&
                        current !== nodeId &&
                        !propagates(edge))
                ) {
                    continue
                }
                chainEdges.add(edge.id)
                nodes.add(to)
                if (!seen.has(to) && propagates(edge)) {
                    seen.add(to)
                    queue.push(to)
                }
            }
        }
    }
    walk('downstream')
    walk('upstream')
    return { nodes, edges: chainEdges }
}
