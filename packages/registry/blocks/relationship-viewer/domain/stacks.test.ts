import { chains, cycle, superspreaders } from '../__tests__/fixtures'
import { build } from '../__tests__/graph'
import type { NodeKey, RelationshipNode, RelationshipStatus } from './model'
import { isStackable, stackLeaves } from './stacks'

const te = (id: string): NodeKey => `trackedEntity:${id}`
const contact: RelationshipStatus = {
    key: 'contact',
    label: 'Contact',
    color: 'blue',
}
const overdue: RelationshipStatus = {
    key: 'overdue',
    label: 'Overdue',
    color: 'orange',
    attention: true,
}
const always = () => true
const hub = () => build(superspreaders(), ['H1'], 1)

test("a hub's leaves become one stack", async () => {
    const { graph, stacks } = stackLeaves(await hub(), always, new Set())
    expect(stacks.size).toBe(1)
    const [[standIn, stack]] = [...stacks]
    expect(stack.hub).toBe(te('H1'))
    expect(stack.members).toHaveLength(12)
    expect(stack.members[0]).toBe(standIn)
    expect(graph.nodes.size).toBe(2)
    expect(graph.edges.size).toBe(1)
    expect(graph.order).toHaveLength(2)
})

test('fewer than four leaves do not stack', async () => {
    const graph = await build(chains(), ['A1'], 2)
    const stacked = stackLeaves(graph, always, new Set())
    expect(stacked.stacks.size).toBe(0)
    expect(stacked.graph).toBe(graph)
})

test('an open hub does not stack', async () => {
    const { stacks } = stackLeaves(await hub(), always, new Set([te('H1')]))
    expect(stacks.size).toBe(0)
})

test('the selected node leaves its stack', async () => {
    const graph = await hub()
    const { graph: stacked, stacks } = stackLeaves(
        graph,
        (node) => isStackable(node, contact, te('H1c01')),
        new Set()
    )
    expect([...stacks.values()][0].members).toHaveLength(11)
    expect(stacked.nodes.has(te('H1c01'))).toBe(true)
})

test('a stack below the minimum dissolves', async () => {
    const graph = await hub()
    const allowed = new Set(['H1c01', 'H1c02', 'H1c03'].map(te))
    const { stacks } = stackLeaves(
        graph,
        (node) => allowed.has(node.key),
        new Set()
    )
    expect(stacks.size).toBe(0)
})

test('attention leaves never stack', async () => {
    const leaf = (await hub()).nodes.get(te('H1c01'))!
    const seed = (await hub()).nodes.get(te('H1'))!
    const failed: RelationshipNode = {
        ...leaf,
        state: { status: 'failed', error: new Error('404') },
    }
    expect(isStackable(leaf, contact, undefined)).toBe(true)
    expect(isStackable(leaf, overdue, undefined)).toBe(false)
    expect(isStackable(seed, contact, undefined)).toBe(false)
    expect(isStackable(failed, contact, undefined)).toBe(false)
    expect(isStackable({ ...leaf, stubCount: 1 }, contact, undefined)).toBe(
        false
    )
    expect(isStackable(leaf, contact, te('H1c01'))).toBe(false)
})

test('cycle members are not leaves', async () => {
    const graph = await build(cycle(), ['C1'])
    expect(stackLeaves(graph, always, new Set()).stacks.size).toBe(0)
})
