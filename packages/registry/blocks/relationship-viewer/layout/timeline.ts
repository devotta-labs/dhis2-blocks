import type { DateOf, NodeKey, RelationshipGraph } from '../domain/model'
import { boundsOf, type GraphLayout, type Point } from './web'

export const DAY_WIDTH = 24
export const ROW_HEIGHT = 28

const DAY_MS = 86_400_000
const MAX_TICKS = 8

export interface TimelineLayout extends GraphLayout {
    ticks: readonly { x: number; label: string }[] // ISO YYYY-MM-DD, at most 8
    noDateLaneX?: number // present only when a node has no date
}

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

const pad = (n: number, width = 2): string => String(n).padStart(width, '0')

/** Local calendar day: DHIS2 timestamps carry no offset, so they parse as local time. */
const isoDay = (date: Date): string =>
    `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

function ticksOf(minTime: number, maxTime: number): TimelineLayout['ticks'] {
    const min = new Date(minTime)
    const max = new Date(maxTime)
    const day = (d: Date, offset = 0): Date =>
        new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset)
    // Rounded: a daylight-saving day is 23 or 25 hours long.
    const span = Math.round((day(max).getTime() - day(min).getTime()) / DAY_MS)
    const count = Math.min(MAX_TICKS, span + 1)
    return Array.from({ length: count }, (_, i) => {
        const days = count === 1 ? 0 : Math.round((i * span) / (count - 1))
        return { x: days * DAY_WIDTH, label: isoDay(day(min, days)) }
    })
}

export function layoutTimeline(
    graph: RelationshipGraph,
    parents: ReadonlyMap<NodeKey, NodeKey | undefined>,
    dateOf: DateOf
): TimelineLayout {
    const times = new Map<NodeKey, number>()
    for (const [key, node] of graph.nodes) {
        const time = dateOf(node)?.getTime()
        if (time !== undefined) times.set(key, time)
    }
    const dated = [...times.values()]
    const minTime = Math.min(...dated)
    const maxTime = Math.max(...dated)
    const hasUndated = times.size < graph.nodes.size
    // The earliest date sits at x = 0, so the lane is 3 days left of it.
    const noDateLaneX = hasUndated ? -3 * DAY_WIDTH : undefined

    const rows = rowsOf(graph, parents)
    const positions = new Map<NodeKey, Point>()
    for (const key of graph.order) {
        const time = times.get(key)
        positions.set(key, {
            x:
                time === undefined
                    ? (noDateLaneX ?? 0)
                    : ((time - minTime) / DAY_MS) * DAY_WIDTH,
            y: (rows.get(key) ?? 0) * ROW_HEIGHT,
        })
    }
    const layout: TimelineLayout = {
        positions,
        bounds: boundsOf(positions.values()),
        ticks: dated.length > 0 ? ticksOf(minTime, maxTime) : [],
    }
    if (noDateLaneX !== undefined) layout.noDateLaneX = noDateLaneX
    return layout
}
