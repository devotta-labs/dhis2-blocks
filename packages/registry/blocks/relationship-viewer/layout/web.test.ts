import { chains, link, person, withLinks } from '../__tests__/fixtures'
import { build } from '../__tests__/graph'
import { layoutWeb } from './web'

const seedsOf = (ids: { ref: { id: string } }[]): string[] =>
    ids.map((r) => r.ref.id)

test('web layout is deterministic', async () => {
    const records = chains()
    const graph = await build(records, seedsOf(records))
    expect([...layoutWeb(graph).positions]).toEqual([
        ...layoutWeb(graph).positions,
    ])
})

test('web layout places every node with finite coordinates', async () => {
    const records = chains()
    const graph = await build(records, seedsOf(records))
    const { positions, bounds } = layoutWeb(graph)
    expect(positions.size).toBe(graph.nodes.size)
    for (const { x, y } of positions.values()) {
        expect(Number.isFinite(x)).toBe(true)
        expect(Number.isFinite(y)).toBe(true)
        expect(x).toBeGreaterThanOrEqual(bounds.minX)
        expect(x).toBeLessThanOrEqual(bounds.maxX)
        expect(y).toBeGreaterThanOrEqual(bounds.minY)
        expect(y).toBeLessThanOrEqual(bounds.maxY)
    }
})

test('an empty graph lays out to empty bounds', async () => {
    const graph = await build([], [])
    expect(layoutWeb(graph).positions.size).toBe(0)
})

test('web layout of a 500-node graph takes under a second', async () => {
    const ids = Array.from({ length: 500 }, (_, i) => `N${i}`)
    const links = ids.flatMap((id, i) => [
        link(`${id}-hub`, `N${i - (i % 10)}`, id),
        link(`${id}-next`, id, `N${(i + 7) % 500}`),
    ])
    const records = withLinks(
        ids.map((id) => person(id)),
        links.filter((l) => l.from.id !== l.to.id)
    )
    const graph = await build(records, ids)
    expect(graph.nodes.size).toBe(500)
    const start = performance.now()
    layoutWeb(graph)
    expect(performance.now() - start).toBeLessThan(1000)
})

test('web layout keeps the space each node asks for', async () => {
    const records = withLinks(
        [person('A'), person('B')],
        [link('AB', 'A', 'B')]
    )
    const graph = await build(records, ['A'])
    const { positions } = layoutWeb(graph, () => 40)
    const a = positions.get('trackedEntity:A')!
    const b = positions.get('trackedEntity:B')!
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(70)
})

test('a warm start keeps known nodes close to where they were', async () => {
    const records = withLinks(
        ['A', 'B', 'C', 'D', 'E'].map((id) => person(id)),
        [link('AB', 'A', 'B'), link('BC', 'B', 'C'), link('CD', 'C', 'D')]
    )
    const before = layoutWeb(await build(records, ['A']), () => 10)
    const grown = withLinks(
        ['A', 'B', 'C', 'D', 'E'].map((id) => person(id)),
        [
            link('AB', 'A', 'B'),
            link('BC', 'B', 'C'),
            link('CD', 'C', 'D'),
            link('DE', 'D', 'E'),
        ]
    )
    const after = layoutWeb(
        await build(grown, ['A']),
        () => 10,
        before.positions
    )
    for (const key of before.positions.keys()) {
        const a = before.positions.get(key)!
        const b = after.positions.get(key)!
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(30)
    }
})
