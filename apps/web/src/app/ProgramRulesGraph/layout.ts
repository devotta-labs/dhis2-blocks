import dagre from '@dagrejs/dagre'
import { checkLoops, type GraphNode, type RulesGraphModel } from './graphModel'

export const NODE_SIZE = {
    rule: { width: 260, height: 76 },
    field: { width: 220, height: 52 },
    variable: { width: 200, height: 44 },
    section: { width: 200, height: 44 },
    stage: { width: 200, height: 44 },
} satisfies Record<GraphNode['kind'], { width: number; height: number }>

/**
 * Left-to-right layers: inputs, the rules that read them, what they write,
 * the rules that read that. Positions are node centres.
 */
export const layoutRulesGraph = (
    model: RulesGraphModel
): Map<string, { x: number; y: number }> => {
    const graph = new dagre.graphlib.Graph()
    graph.setGraph({
        rankdir: 'LR',
        nodesep: 14,
        ranksep: 110,
        marginx: 24,
        marginy: 24,
    })
    graph.setDefaultEdgeLabel(() => ({}))
    for (const node of model.nodes) {
        graph.setNode(node.id, { ...NODE_SIZE[node.kind] })
    }
    const loops = new Set(
        [...checkLoops(model).values()].map((edge) => edge.id)
    )
    for (const edge of model.edges) {
        if (!loops.has(edge.id)) {
            graph.setEdge(edge.source, edge.target)
        }
    }
    dagre.layout(graph)
    return new Map(
        model.nodes.map((node) => {
            const { x = 0, y = 0 } = graph.node(node.id) ?? {}
            return [node.id, { x, y }]
        })
    )
}
