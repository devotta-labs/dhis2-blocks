import {
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

export function layoutWeb(graph: RelationshipGraph): GraphLayout {
    const nodes: SimNode[] = graph.order.map((key) => ({ key }))
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
    simulation.tick(TICKS)

    const positions = new Map<NodeKey, Point>(
        nodes.map((node) => [node.key, { x: node.x ?? 0, y: node.y ?? 0 }])
    )
    return { positions, bounds: boundsOf(positions.values()) }
}
