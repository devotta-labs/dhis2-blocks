import {
    chains,
    cycle,
    fakeFetch,
    link,
    person,
    superspreaders,
    withLinks,
} from '../__tests__/fixtures'
import type { RelationshipStatus } from './model'
import { generations, orientEdges } from './orientation'
import { summarize } from './summary'
import { traverse } from './traverse'
import { build, dateOf } from '../__tests__/graph'

const statuses: RelationshipStatus[] = [
    { key: 'case', label: 'Case', color: 'red' },
    { key: 'contact', label: 'Contact', color: 'blue' },
    { key: 'overdue', label: 'Overdue', color: 'orange', attention: true },
]

const summaryOf = async (
    graph: Awaited<ReturnType<typeof build>>,
    statusOf: Parameters<typeof summarize>[3] = () => 'case'
) => {
    const orientation = orientEdges(graph, dateOf)
    return summarize(
        graph,
        orientation,
        generations(graph, orientation),
        statusOf,
        statuses
    )
}

const ids = (records: { ref: { id: string } }[]) => records.map((r) => r.ref.id)

test('chains are deep, superspreaders are wide', async () => {
    const c = chains()
    const s = superspreaders()
    expect(await summaryOf(await build(c, ids(c)))).toMatchObject({
        generationCount: 7,
        clusterCount: 4,
        maxOut: 2,
    })
    expect(await summaryOf(await build(s, ids(s)))).toMatchObject({
        generationCount: 2,
        clusterCount: 3,
        maxOut: 12,
    })
})

test('summary of a lone seed', async () => {
    expect(await summaryOf(await build([person('A')], ['A']))).toMatchObject({
        nodeCount: 1,
        generationCount: 1,
        clusterCount: 1,
        largestCluster: 1,
        maxOut: 0,
        meanOut: 0,
        partial: false,
    })
})

test('meanOut is over nodes with outgoing edges, one decimal', async () => {
    const records = withLinks(
        ['A', 'B', 'C', 'D'].map((id) => person(id)),
        [link('AB', 'A', 'B'), link('AC', 'A', 'C'), link('BD', 'B', 'D')]
    )
    expect(await summaryOf(await build(records, ['A']))).toMatchObject({
        maxOut: 2,
        meanOut: 1.5,
        largestCluster: 4,
    })
    const three = withLinks(
        ['A', 'B', 'C', 'D'].map((id) => person(id)),
        [
            link('AB', 'A', 'B'),
            link('AC', 'A', 'C'),
            link('AD', 'A', 'D'),
            link('BC', 'B', 'C'),
        ]
    )
    expect((await summaryOf(await build(three, ['A']))).meanOut).toBe(2)
    const third = withLinks(
        ['A', 'B', 'C', 'D', 'E'].map((id) => person(id)),
        [
            link('AB', 'A', 'B'),
            link('AC', 'A', 'C'),
            link('BD', 'B', 'D'),
            link('DE', 'D', 'E'),
        ]
    )
    // out-degrees 2, 1, 1 -> 1.333...
    expect((await summaryOf(await build(third, ['A']))).meanOut).toBe(1.3)
})

test('attention statuses are listed first and counted', async () => {
    const graph = await build(cycle(), ['C1'])
    const summary = await summaryOf(graph, (node) =>
        node.key === 'trackedEntity:C1' ? 'overdue' : 'contact'
    )
    expect(summary.statusCounts.map((s) => [s.status.key, s.count])).toEqual([
        ['overdue', 1],
        ['case', 0],
        ['contact', 2],
    ])
    expect(summary.attentionCount).toBe(1)
})

test('an unknown status key counts toward nodes but no row', async () => {
    const graph = await build(cycle(), ['C1'])
    const summary = await summaryOf(graph, () => 'mystery')
    expect(summary.nodeCount).toBe(3)
    expect(summary.statusCounts.every((s) => s.count === 0)).toBe(true)
})

test('stubs, failures and the cap make the summary partial', async () => {
    const records = withLinks(
        ['A', 'B', 'C'].map((id) => person(id)),
        [link('AB', 'A', 'B'), link('BC', 'B', 'C')]
    )
    const stubbed = await build(records, ['A'], 1)
    expect(stubbed.nodes.get('trackedEntity:B')?.stubCount).toBe(1)
    expect((await summaryOf(stubbed)).partial).toBe(true)

    const failed = await traverse(
        [{ kind: 'trackedEntity', id: 'A' }],
        fakeFetch(records, { fail: new Set(['B']) }),
        { hops: 10, cap: 500, concurrency: 6 }
    )
    expect((await summaryOf(failed)).partial).toBe(true)

    const capped = await traverse(
        [{ kind: 'trackedEntity', id: 'A' }],
        fakeFetch(records),
        { hops: 10, cap: 2, concurrency: 6 }
    )
    expect(capped.capped).toBe(true)
    expect((await summaryOf(capped)).partial).toBe(true)
})

test('unloaded links are counted per record', async () => {
    // A1 exposes A1c and A2; A2's own two links are past the hop limit.
    const stubbed = await summaryOf(await build(chains(), ['A1'], 1))
    expect(stubbed.unloadedLinkCount).toBe(2)
    expect(stubbed.unloadedNodeCount).toBe(1)

    const lone = await summaryOf(await build([person('L')], ['L']))
    expect(lone.unloadedLinkCount).toBe(0)
    expect(lone.unloadedNodeCount).toBe(0)
})
