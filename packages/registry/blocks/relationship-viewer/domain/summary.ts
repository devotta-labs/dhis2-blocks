import { clusters, type Orientation } from './orientation'
import type {
    NodeKey,
    RelationshipGraph,
    RelationshipNode,
    RelationshipStatus,
} from './model'

export interface OutbreakSummary {
    nodeCount: number
    statusCounts: readonly { status: RelationshipStatus; count: number }[] // attention first, then declaration order; zero counts kept
    attentionCount: number
    clusterCount: number
    largestCluster: number
    generationCount: number // max generation + 1; 0 for an empty graph
    maxOut: number
    meanOut: number // over nodes with ≥1 outgoing oriented edge, rounded to 1 decimal
    partial: boolean // any stub, failed node, or capped
    unloadedLinkCount: number // sum of stub counts over drawn nodes
    unloadedNodeCount: number // drawn nodes with at least one stub
}

export function summarize(
    graph: RelationshipGraph,
    orientation: ReadonlyMap<string, Orientation>,
    gens: ReadonlyMap<NodeKey, number>,
    statusOf: (node: RelationshipNode) => string,
    statuses: readonly RelationshipStatus[]
): OutbreakSummary {
    const nodes = [...graph.nodes.values()]
    const counts = new Map<string, number>()
    nodes.forEach((node) => {
        const key = statusOf(node)
        counts.set(key, (counts.get(key) ?? 0) + 1)
    })
    // Array.prototype.sort is stable, so declaration order holds within each group.
    const statusCounts = [...statuses]
        .sort((a, b) => Number(!!b.attention) - Number(!!a.attention))
        .map((status) => ({ status, count: counts.get(status.key) ?? 0 }))

    const outDegree = new Map<NodeKey, number>()
    for (const { source } of orientation.values()) {
        outDegree.set(source, (outDegree.get(source) ?? 0) + 1)
    }
    const degrees = [...outDegree.values()]
    const total = degrees.reduce((sum, d) => sum + d, 0)
    const sizes = clusters(graph).map((c) => c.length)

    return {
        nodeCount: nodes.length,
        statusCounts,
        attentionCount: statusCounts
            .filter(({ status }) => status.attention)
            .reduce((sum, { count }) => sum + count, 0),
        clusterCount: sizes.length,
        largestCluster: Math.max(0, ...sizes),
        generationCount: Math.max(-1, ...gens.values()) + 1,
        maxOut: Math.max(0, ...degrees),
        meanOut:
            degrees.length === 0
                ? 0
                : Math.round((total / degrees.length) * 10) / 10,
        unloadedLinkCount: nodes.reduce((sum, node) => sum + node.stubCount, 0),
        unloadedNodeCount: nodes.filter((node) => node.stubCount > 0).length,
        partial:
            graph.capped ||
            nodes.some(
                (node) => node.stubCount > 0 || node.state.status === 'failed'
            ),
    }
}
