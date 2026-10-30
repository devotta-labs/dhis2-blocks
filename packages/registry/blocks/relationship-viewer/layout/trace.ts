import type { NodeKey, RelationshipGraph } from '../domain/model'
import { boundsOf, type GraphLayout, type Point } from './web'

export const CARD_WIDTH = 176
export const CARD_HEIGHT = 64
export const COLUMN_GAP = 64
export const ROW_GAP = 12
// How far a link that does not go to a later column reaches past the cards.
const BRACKET = 16

/** Rows over the parent forest: a leaf takes the next row, a parent the mean of its children's. */
function rowsOf(
    graph: RelationshipGraph,
    parents: ReadonlyMap<NodeKey, NodeKey | undefined>
): Map<NodeKey, number> {
    const children = new Map<NodeKey, NodeKey[]>()
    const roots: NodeKey[] = []
    for (const key of graph.order) {
        const parent = parents.get(key)
        if (parent === undefined) {
            roots.push(key)
        } else {
            children.set(parent, [...(children.get(parent) ?? []), key])
        }
    }
    const rows = new Map<NodeKey, number>()
    let next = 0
    const place = (key: NodeKey): number => {
        const kids = children.get(key) ?? []
        const row =
            kids.length === 0
                ? next++
                : kids.reduce((sum, kid) => sum + place(kid), 0) / kids.length
        rows.set(key, row)
        return row
    }
    for (const root of roots) {
        place(root)
        next++ // blank row between trees
    }
    return rows
}

/** Cards in one column per generation, rows in tree order; positions are card centres. */
export function layoutTrace(
    graph: RelationshipGraph,
    parents: ReadonlyMap<NodeKey, NodeKey | undefined>,
    gens: ReadonlyMap<NodeKey, number>
): GraphLayout {
    const rows = rowsOf(graph, parents)
    const positions = new Map<NodeKey, Point>(
        graph.order.map((key) => [
            key,
            {
                x: (gens.get(key) ?? 0) * (CARD_WIDTH + COLUMN_GAP),
                y: (rows.get(key) ?? 0) * (CARD_HEIGHT + ROW_GAP),
            },
        ])
    )
    const centres = boundsOf(positions.values())
    return {
        positions,
        bounds: {
            minX: centres.minX - CARD_WIDTH / 2,
            maxX: centres.maxX + CARD_WIDTH / 2,
            minY: centres.minY - CARD_HEIGHT / 2,
            maxY: centres.maxY + CARD_HEIGHT / 2,
        },
    }
}

/** From the source card's right edge to the target card's left edge, or a bracket on the right when it does not go right. */
export function elbowPath(from: Point, to: Point): string {
    const half = CARD_WIDTH / 2
    const start = from.x + half
    if (to.x > from.x) {
        const end = to.x - half
        return `M${start},${from.y} H${(start + end) / 2} V${to.y} H${end}`
    }
    const reach = Math.max(from.x, to.x) + half + BRACKET
    return `M${start},${from.y} H${reach} V${to.y} H${to.x + half}`
}
