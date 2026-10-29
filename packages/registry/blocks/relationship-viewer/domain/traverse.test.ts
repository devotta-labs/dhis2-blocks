import {
    chains,
    cycle,
    fakeFetch,
    link,
    person,
    superspreaders,
    withLinks,
} from '../__tests__/fixtures'
import type { NodeKey, NodeRecord, NodeRef } from './model'
import { traverse, type TraversalOptions } from './traverse'

const opts = (overrides: Partial<TraversalOptions> = {}): TraversalOptions => ({
    hops: 1,
    cap: 500,
    concurrency: 6,
    ...overrides,
})
const te = (id: string): NodeRef => ({ kind: 'trackedEntity', id })
const key = (id: string): NodeKey => `trackedEntity:${id}`

/** A→B→C→D */
const chain = (): NodeRecord[] =>
    withLinks(
        ['A', 'B', 'C', 'D'].map((id) => person(id)),
        [link('AB', 'A', 'B'), link('BC', 'B', 'C'), link('CD', 'C', 'D')]
    )

test('lone seed', async () => {
    const g = await traverse([te('A')], fakeFetch([person('A')]), opts())
    expect([...g.nodes.keys()]).toEqual(['trackedEntity:A'])
    expect(g.nodes.get('trackedEntity:A')).toMatchObject({
        hop: 0,
        seed: true,
        stubCount: 0,
    })
})

test('stops at the hop limit and counts exact stubs', async () => {
    const fetch = fakeFetch(chain())
    const g = await traverse([te('A')], fetch, opts())
    expect([...g.nodes.keys()]).toEqual([key('A'), key('B')])
    expect(g.nodes.get(key('A'))?.stubCount).toBe(0)
    expect(g.nodes.get(key('B'))).toMatchObject({
        hop: 1,
        seed: false,
        discoveredVia: 'AB',
        stubCount: 1,
    })
    expect([...g.edges.keys()]).toEqual(['AB'])
    expect(g.capped).toBe(false)
    expect(fetch.calls.map((r) => r.id)).toEqual(['A', 'B'])
})

test('expanded nodes draw past the hop limit', async () => {
    const g = await traverse(
        [te('A')],
        fakeFetch(chain()),
        opts({ expanded: new Set([key('B')]) })
    )
    expect([...g.nodes.keys()]).toEqual([key('A'), key('B'), key('C')])
    expect(g.nodes.get(key('C'))).toMatchObject({
        hop: 2,
        discoveredVia: 'BC',
        stubCount: 1,
    })
    expect(g.nodes.get(key('B'))?.stubCount).toBe(0)
})

test('dedupes a relationship seen from both ends', async () => {
    const g = await traverse(
        [te('A')],
        fakeFetch(
            withLinks(
                [person('A'), person('B')],
                [link('AB', 'A', 'B', { bidirectional: true })]
            )
        ),
        opts()
    )
    expect(g.edges.size).toBe(1)
    expect(g.edges.get('AB')).toMatchObject({
        from: key('A'),
        to: key('B'),
        bidirectional: true,
    })
    expect(g.nodes.get(key('A'))?.stubCount).toBe(0)
    expect(g.nodes.get(key('B'))?.stubCount).toBe(0)
})

test('survives cycles', async () => {
    const fetch = fakeFetch(cycle())
    const g = await traverse([te('C1')], fetch, opts({ hops: 5 }))
    expect(g.nodes.size).toBe(3)
    expect(g.edges.size).toBe(3)
    expect(fetch.calls).toHaveLength(3)
})

test('counts links of unfollowed types as other links', async () => {
    const g = await traverse(
        [te('A')],
        fakeFetch(
            withLinks(
                [person('A'), person('B'), person('X')],
                [
                    link('AB', 'A', 'B', { type: 'exposed' }),
                    link('AX', 'A', 'X', { type: 'contact' }),
                ]
            )
        ),
        opts({ followTypes: new Set(['exposed']) })
    )
    expect([...g.nodes.keys()]).toEqual([key('A'), key('B')])
    expect(g.nodes.get(key('A'))).toMatchObject({
        otherLinkCount: 1,
        stubCount: 0,
    })
    expect([...g.edges.keys()]).toEqual(['AB'])
})

test('counts relationships with an unresolvable side as other links', async () => {
    const [a, b] = withLinks([person('A'), person('B')], [link('AB', 'A', 'B')])
    const g = await traverse(
        [te('A')],
        fakeFetch([{ ...a, unresolvedLinkCount: 2 }, b]),
        opts()
    )
    expect(g.nodes.get(key('A'))).toMatchObject({
        otherLinkCount: 2,
        stubCount: 0,
    })
    expect(g.nodes.get(key('B'))?.otherLinkCount).toBe(0)
    expect([...g.edges.keys()]).toEqual(['AB'])
})

test('caps the node count and marks the graph capped', async () => {
    const g = await traverse(
        [te('H1'), te('H2'), te('H3')],
        fakeFetch(superspreaders()),
        opts({ cap: 10 })
    )
    expect(g.nodes.size).toBe(10)
    expect(g.capped).toBe(true)
    // H1 fills the remaining 7 slots; the other hubs get none
    expect(g.nodes.get(key('H1'))?.stubCount).toBe(5)
    expect(g.nodes.get(key('H2'))?.stubCount).toBe(12)
    expect(g.nodes.get(key('H3'))?.stubCount).toBe(12)
})

test('per-node failure', async () => {
    const g = await traverse(
        [te('A')],
        fakeFetch(
            withLinks(
                [person('A'), person('B'), person('C')],
                [
                    link('AB', 'A', 'B'),
                    link('AC', 'A', 'C'),
                    link('CB', 'C', 'B'),
                ]
            ),
            { fail: new Set(['B']) }
        ),
        opts()
    )
    expect(g.nodes.get(key('B'))).toMatchObject({
        state: { status: 'failed', error: { status: 404 } },
        stubCount: 0,
    })
    expect(g.nodes.get(key('A'))?.state.status).toBe('loaded')
    expect(g.nodes.get(key('C'))?.state.status).toBe('loaded')
    // the failed node is drawn, so edges to it exist
    expect([...g.edges.keys()].sort()).toEqual(['AB', 'AC', 'CB'])
})

test('many seeds share one walk', async () => {
    const fetch = fakeFetch(chain())
    const g = await traverse([te('A'), te('D')], fetch, opts())
    const ids = fetch.calls.map((r) => r.id)
    expect(ids).toEqual(['A', 'D', 'B', 'C'])
    expect(new Set(ids).size).toBe(ids.length)
    // AB, CD, and BC (both ends drawn)
    expect(g.edges.size).toBe(3)
})

test('order is breadth-first discovery order', async () => {
    const g = await traverse([te('A1')], fakeFetch(chains()), opts())
    expect(g.order).toEqual([key('A1'), key('A1c'), key('A2')])
})

test('ignores duplicate seeds and self-links', async () => {
    const g = await traverse(
        [te('A'), te('A')],
        fakeFetch(withLinks([person('A')], [link('AA', 'A', 'A')])),
        opts()
    )
    expect(g.order).toEqual([key('A')])
    expect(g.edges.size).toBe(0)
    expect(g.nodes.get(key('A'))?.stubCount).toBe(0)
})

test('applies results in level order however fetches resolve', async () => {
    // A -> B, C at level 1; B -> D and C -> E are the level-2 candidates.
    const records = withLinks(
        ['A', 'B', 'C', 'D', 'E'].map((id) => person(id)),
        [
            link('AB', 'A', 'B'),
            link('AC', 'A', 'C'),
            link('BD', 'B', 'D'),
            link('CE', 'C', 'E'),
        ]
    )
    // B resolves after C, so resolve order would let C claim the last slot.
    const delays = new Map([
        ['B', 30],
        ['C', 5],
    ])
    const fetch = (ref: NodeRef): Promise<NodeRecord> =>
        new Promise((resolve) =>
            setTimeout(
                () => resolve(records.find((r) => r.ref.id === ref.id)!),
                delays.get(ref.id) ?? 0
            )
        )
    const g = await traverse(
        [te('A')],
        fetch,
        opts({ hops: 2, cap: 4, concurrency: 3 })
    )
    // one slot left: B (first in order) draws D; C's E is refused
    expect(g.order).toEqual([key('A'), key('B'), key('C'), key('D')])
    expect(g.capped).toBe(true)
    expect(g.nodes.get(key('C'))?.stubCount).toBe(1)
})
