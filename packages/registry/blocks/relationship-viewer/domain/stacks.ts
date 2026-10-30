import type {
    NodeKey,
    RelationshipEdge,
    RelationshipGraph,
    RelationshipNode,
    RelationshipStatus,
} from './model'

const STACK_MIN = 4

export interface Stack {
    hub: NodeKey // the one node every member links to
    members: readonly NodeKey[] // discovery order; members[0] stands in for the stack in the stacked graph
}

export interface Stacked {
    graph: RelationshipGraph // members[1..] and their edges removed
    stacks: ReadonlyMap<NodeKey, Stack> // keyed by members[0]
}

/** Loaded, not a seed, not an attention status, not selected, no stubs. */
export const isStackable = (
    node: RelationshipNode,
    status: RelationshipStatus | undefined,
    selected: NodeKey | undefined
): boolean =>
    node.state.status === 'loaded' &&
    !node.seed &&
    !status?.attention &&
    node.key !== selected &&
    node.stubCount === 0

/** Leaves (exactly one drawn edge) grouped by hub; a group of at least STACK_MIN stackable leaves becomes a stack unless its hub is in `open`. */
export function stackLeaves(
    graph: RelationshipGraph,
    stackable: (node: RelationshipNode) => boolean,
    open: ReadonlySet<NodeKey>
): Stacked {
    const drawn = [...graph.edges.values()].filter(
        (edge) => graph.nodes.has(edge.from) && graph.nodes.has(edge.to)
    )
    const edgesOf = new Map<NodeKey, RelationshipEdge[]>()
    for (const edge of drawn) {
        for (const end of [edge.from, edge.to]) {
            edgesOf.set(end, [...(edgesOf.get(end) ?? []), edge])
        }
    }

    const leavesOf = new Map<NodeKey, NodeKey[]>()
    for (const key of graph.order) {
        const edges = edgesOf.get(key) ?? []
        const node = graph.nodes.get(key)
        if (edges.length !== 1 || !node || !stackable(node)) continue
        const hub = edges[0].from === key ? edges[0].to : edges[0].from
        if (open.has(hub)) continue
        leavesOf.set(hub, [...(leavesOf.get(hub) ?? []), key])
    }

    const stacks = new Map<NodeKey, Stack>()
    const hidden = new Set<NodeKey>()
    for (const [hub, members] of leavesOf) {
        if (members.length < STACK_MIN) continue
        stacks.set(members[0], { hub, members })
        members.slice(1).forEach((key) => hidden.add(key))
    }
    if (stacks.size === 0) return { graph, stacks }

    return {
        graph: {
            ...graph,
            nodes: new Map(
                [...graph.nodes].filter(([key]) => !hidden.has(key))
            ),
            edges: new Map(
                [...graph.edges].filter(
                    ([, edge]) => !hidden.has(edge.from) && !hidden.has(edge.to)
                )
            ),
            order: graph.order.filter((key) => !hidden.has(key)),
        },
        stacks,
    }
}

/** Equal for equal stacks, so a caller can keep its stacked graph when nothing moved between stacks. */
export const stackKey = (stacks: ReadonlyMap<NodeKey, Stack>): string =>
    [...stacks.values()]
        .map(({ hub, members }) => `${hub}>${members.join(',')}`)
        .join('|')
