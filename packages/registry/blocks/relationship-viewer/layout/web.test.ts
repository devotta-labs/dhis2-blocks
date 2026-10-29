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
