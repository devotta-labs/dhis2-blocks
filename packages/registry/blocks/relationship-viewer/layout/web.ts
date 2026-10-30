import {
    forceCollide,
    forceLink,
    forceManyBody,
    forceSimulation,
    forceX,
    forceY,
    type SimulationLinkDatum,
    type SimulationNodeDatum,
} from 'd3-force'
import type { NodeKey, RelationshipGraph } from '../domain/model'

export interface Point {
    x: number
    y: number
}
export interface Bounds {
    minX: number
    minY: number
    maxX: number
    maxY: number
}
export interface GraphLayout {
    positions: ReadonlyMap<NodeKey, Point>
    bounds: Bounds
}

export const boundsOf = (points: Iterable<Point>): Bounds => {
    const bounds = {
        minX: Infinity,
        minY: Infinity,
        maxX: -Infinity,
        maxY: -Infinity,
    }
    for (const { x, y } of points) {
        bounds.minX = Math.min(bounds.minX, x)
        bounds.minY = Math.min(bounds.minY, y)
        bounds.maxX = Math.max(bounds.maxX, x)
        bounds.maxY = Math.max(bounds.maxY, y)
    }
    return bounds.minX === Infinity
        ? { minX: 0, minY: 0, maxX: 0, maxY: 0 }
        : bounds
}

/** Fixed-seed LCG so the simulation's jiggle, and so the layout, is repeatable. */
const lcg = (): (() => number) => {
    let state = 1
    return () =>
        (state = (1664525 * state + 1013904223) % 4294967296) / 4294967296
}

interface SimNode extends SimulationNodeDatum {
    key: NodeKey
}

const TICKS = 300

const WARM_ALPHA = 0.3
const JITTER = 8

/**
 * `space` is how far a node keeps others away (its mark plus any label); without it, only links and charge apply.
 * `from` is a previous layout: when it knows most nodes, the simulation starts there and settles gently, so the picture stays put.
 */
export function layoutWeb(
    graph: RelationshipGraph,
    space?: (key: NodeKey) => number,
    from?: ReadonlyMap<NodeKey, Point>
): GraphLayout {
    const random = lcg()
    const neighbourOf = (key: NodeKey): Point | undefined => {
        for (const edge of graph.edges.values()) {
            const other =
                (edge.from === key && edge.to) ||
                (edge.to === key && edge.from) ||
                undefined
            const at = other && from?.get(other)
            if (at) return at
        }
        return undefined
    }
    const known = graph.order.filter((key) => from?.has(key)).length
    const warm = known * 2 > graph.order.length
    const nodes: SimNode[] = graph.order.map((key) => {
        const at = from?.get(key)
        if (at) return { key, x: at.x, y: at.y }
        // A node new to the picture starts beside a neighbour it already has.
        const near = warm ? neighbourOf(key) : undefined
        return near
            ? {
                  key,
                  x: near.x + (random() - 0.5) * JITTER,
                  y: near.y + (random() - 0.5) * JITTER,
              }
            : { key }
    })
    const links: SimulationLinkDatum<SimNode>[] = [...graph.edges.values()]
        .filter((e) => graph.nodes.has(e.from) && graph.nodes.has(e.to))
        .map((e) => ({ source: e.from, target: e.to }))
    const simulation = forceSimulation(nodes)
        .randomSource(lcg())
        .force(
            'link',
            forceLink<SimNode, SimulationLinkDatum<SimNode>>(links)
                .id((node) => node.key)
                .distance(40)
        )
        .force('charge', forceManyBody().strength(-60))
        .force('x', forceX().strength(0.05))
        .force('y', forceY().strength(0.05))
        .stop()
    if (warm) simulation.alpha(WARM_ALPHA)
    if (space) {
        simulation.force(
            'collide',
            forceCollide<SimNode>((node) => space(node.key))
        )
    }
    simulation.tick(TICKS)

    const positions = new Map<NodeKey, Point>(
        nodes.map((node) => [node.key, { x: node.x ?? 0, y: node.y ?? 0 }])
    )
    return { positions, bounds: boundsOf(positions.values()) }
}
