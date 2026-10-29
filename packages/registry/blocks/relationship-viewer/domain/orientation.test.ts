import {
    chains,
    cycle,
    link,
    person,
    superspreaders,
    withLinks,
} from '../__tests__/fixtures'
import type { NodeKey, NodeRecord } from './model'
import { generations, orientEdges, timelineParents } from './orientation'

import { build, dateOf } from '../__tests__/graph'

const te = (id: string): NodeKey => `trackedEntity:${id}`
const seedsOf = (records: NodeRecord[]): string[] =>
    records.map((r) => r.ref.id)

test('one-way links keep their direction', async () => {
    const records = chains()
    const graph = await build(records, seedsOf(records))
    const orientation = orientEdges(graph, dateOf)
    expect(orientation.size).toBe(graph.edges.size)
    for (const edge of graph.edges.values()) {
        expect(orientation.get(edge.id)).toEqual({
            source: edge.from,
            target: edge.to,
        })
    }
})

test('two-way links point from earlier to later', async () => {
    const records = superspreaders()
    const graph = await build(records, seedsOf(records))
    const orientation = orientEdges(graph, dateOf)
    for (const edge of graph.edges.values()) {
        const hub = [edge.from, edge.to].find((k) => /H\d$/.test(k))
        expect(orientation.get(edge.id)?.source).toBe(hub)
    }
})

test('same-date two-way links follow discovery order', async () => {
    const graph = await build(cycle(), ['C1'])
    const orientation = orientEdges(graph, dateOf)
    expect(orientation.get('C1-C2')).toEqual({
        source: te('C1'),
        target: te('C2'),
    })
    expect(orientation.get('C3-C1')).toEqual({
        source: te('C1'),
        target: te('C3'),
    })
    expect(orientation.get('C2-C3')).toEqual({
        source: te('C2'),
        target: te('C3'),
    })
})

test('generations are defined on a pure cycle', async () => {
    const graph = await build(cycle(), ['C1'])
    const gens = generations(graph, orientEdges(graph, dateOf))
    expect(Object.fromEntries(gens)).toEqual({
        [te('C1')]: 0,
        [te('C2')]: 1,
        [te('C3')]: 1,
    })
})

test('a one-way cycle uses its seeds as roots', async () => {
    const records = withLinks(
        ['A', 'B', 'C'].map((id) => person(id)),
        [link('AB', 'A', 'B'), link('BC', 'B', 'C'), link('CA', 'C', 'A')]
    )
    const graph = await build(records, ['B'])
    const gens = generations(graph, orientEdges(graph, dateOf))
    expect(Object.fromEntries(gens)).toEqual({
        [te('B')]: 0,
        [te('C')]: 1,
        [te('A')]: 2,
    })
})

test('a cycle hanging off a rooted cluster still gets generations', async () => {
    // R→X, Y→X, X→Y: Y and X have incoming edges, only R is a root; Y is reached via X.
    const records = withLinks(
        ['R', 'X', 'Y', 'Z'].map((id) => person(id)),
        [
            link('RX', 'R', 'X'),
            link('XY', 'X', 'Y'),
            link('YZ', 'Y', 'Z'),
            link('ZY', 'Z', 'Y'),
        ]
    )
    const graph = await build(records, ['R'])
    const gens = generations(graph, orientEdges(graph, dateOf))
    expect(gens.size).toBe(4)
})

test('timeline parents are the earliest-discovered incoming source', async () => {
    const records = withLinks(
        ['A', 'B', 'C'].map((id) => person(id)),
        [link('BC', 'B', 'C'), link('AC', 'A', 'C'), link('AB', 'A', 'B')]
    )
    const graph = await build(records, ['A'])
    const parents = timelineParents(graph, orientEdges(graph, dateOf))
    expect(parents.get(te('A'))).toBeUndefined()
    expect(parents.has(te('A'))).toBe(true)
    expect(parents.get(te('B'))).toBe(te('A'))
    expect(parents.get(te('C'))).toBe(te('A'))
})

test('a one-way cycle has no cyclic timeline parents', async () => {
    const records = withLinks(
        ['A', 'B', 'C'].map((id) => person(id)),
        [link('AB', 'A', 'B'), link('BC', 'B', 'C'), link('CA', 'C', 'A')]
    )
    const graph = await build(records, ['B'])
    const parents = timelineParents(graph, orientEdges(graph, dateOf))
    expect(Object.fromEntries(parents)).toEqual({
        [te('B')]: undefined,
        [te('C')]: te('B'),
        [te('A')]: te('C'),
    })
    for (const start of parents.keys()) {
        const seen = new Set<NodeKey>()
        for (let k: NodeKey | undefined = start; k; k = parents.get(k)) {
            expect(seen.has(k)).toBe(false)
            seen.add(k)
        }
    }
})

describe('two-way link orientation by date', () => {
    const pair = async (a?: string, b?: string) => {
        const undated = (id: string, at?: string): NodeRecord => {
            const record = person(id, { enrolledAt: at })
            return at ? record : { ...record, enrollments: [] }
        }
        const graph = await build(
            withLinks(
                [undated('A', a), undated('B', b)],
                [link('AB', 'A', 'B', { bidirectional: true })]
            ),
            ['A']
        )
        return orientEdges(graph, dateOf).get('AB')?.source
    }

    test('the earlier-dated node is the source even when discovered later', async () => {
        expect(await pair('2026-01-09', '2026-01-02')).toBe(te('B'))
        expect(await pair('2026-01-02', '2026-01-09')).toBe(te('A'))
    })
    test('equal dates follow discovery order', async () => {
        expect(await pair('2026-01-05', '2026-01-05')).toBe(te('A'))
    })
    test('an undated side falls back to discovery order', async () => {
        expect(await pair(undefined, '2026-01-02')).toBe(te('A'))
        expect(await pair('2026-01-09', undefined)).toBe(te('A'))
    })
})
