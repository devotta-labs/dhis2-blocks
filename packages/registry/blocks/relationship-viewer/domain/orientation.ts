import type { DateOf, NodeKey, RelationshipGraph } from './model'

export interface Orientation {
    source: NodeKey
    target: NodeKey
}

const orderIndex = (graph: RelationshipGraph): Map<NodeKey, number> =>
    new Map(graph.order.map((key, i) => [key, i]))

export function orientEdges(
    graph: RelationshipGraph,
    dateOf: DateOf
): ReadonlyMap<string, Orientation> {
    const index = orderIndex(graph)
    const time = (key: NodeKey): number | undefined => {
        const node = graph.nodes.get(key)
        return node ? dateOf(node)?.getTime() : undefined
    }
    const result = new Map<string, Orientation>()
    for (const edge of graph.edges.values()) {
        const a = time(edge.from)
        const b = time(edge.to)
        const dated = a !== undefined && b !== undefined && a !== b
        const fromFirst =
            !edge.bidirectional ||
            (dated
                ? a < b
                : (index.get(edge.from) ?? 0) <= (index.get(edge.to) ?? 0))
        result.set(
            edge.id,
            fromFirst
                ? { source: edge.from, target: edge.to }
                : { source: edge.to, target: edge.from }
        )
    }
    return result
}

/** Connected components, ignoring orientation; each lists its nodes in discovery order. */
export function clusters(graph: RelationshipGraph): NodeKey[][] {
    const neighbours = new Map<NodeKey, NodeKey[]>()
    for (const edge of graph.edges.values()) {
        neighbours.set(edge.from, [
            ...(neighbours.get(edge.from) ?? []),
            edge.to,
        ])
        neighbours.set(edge.to, [...(neighbours.get(edge.to) ?? []), edge.from])
    }
    const index = orderIndex(graph)
    const seen = new Set<NodeKey>()
    const result: NodeKey[][] = []
    for (const start of graph.order) {
        if (seen.has(start)) continue
        seen.add(start)
        const members = [start]
        for (let i = 0; i < members.length; i++) {
            for (const next of neighbours.get(members[i]) ?? []) {
                if (!seen.has(next)) {
                    seen.add(next)
                    members.push(next)
                }
            }
        }
        result.push(members.sort((x, y) => index.get(x)! - index.get(y)!))
    }
    return result
}

export function generations(
    graph: RelationshipGraph,
    orientation: ReadonlyMap<string, Orientation>
): ReadonlyMap<NodeKey, number> {
    const out = new Map<NodeKey, NodeKey[]>()
    const hasIncoming = new Set<NodeKey>()
    for (const { source, target } of orientation.values()) {
        out.set(source, [...(out.get(source) ?? []), target])
        hasIncoming.add(target)
    }
    const roots = new Set(graph.order.filter((key) => !hasIncoming.has(key)))
    for (const members of clusters(graph)) {
        if (members.some((key) => roots.has(key))) continue
        const seeds = members.filter((key) => graph.nodes.get(key)?.seed)
        for (const key of seeds.length > 0 ? seeds : members.slice(0, 1)) {
            roots.add(key)
        }
    }

    const gens = new Map<NodeKey, number>()
    const walk = (queue: NodeKey[]): void => {
        for (let i = 0; i < queue.length; i++) {
            for (const next of out.get(queue[i]) ?? []) {
                if (!gens.has(next)) {
                    gens.set(next, gens.get(queue[i])! + 1)
                    queue.push(next)
                }
            }
        }
    }
    const start = (queue: NodeKey[]): void => {
        queue.forEach((key) => gens.set(key, 0))
        walk(queue)
    }
    start(graph.order.filter((key) => roots.has(key)))
    // A cycle hanging off a rooted cluster can stay unreached; root its first node.
    for (const key of graph.order) {
        if (!gens.has(key)) start([key])
    }
    return gens
}

export function timelineParents(
    graph: RelationshipGraph,
    orientation: ReadonlyMap<string, Orientation>
): ReadonlyMap<NodeKey, NodeKey | undefined> {
    const index = orderIndex(graph)
    const gens = generations(graph, orientation)
    const parents = new Map<NodeKey, NodeKey | undefined>(
        graph.order.map((key) => [key, undefined])
    )
    // Only edges from the previous generation: parent chains then strictly descend, so they never loop.
    for (const { source, target } of orientation.values()) {
        const current = parents.get(target)
        if (
            gens.get(source) !== (gens.get(target) ?? 0) - 1 ||
            (current !== undefined &&
                (index.get(source) ?? 0) >= (index.get(current) ?? 0))
        ) {
            continue
        }
        parents.set(target, source)
    }
    return parents
}
