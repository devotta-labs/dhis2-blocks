import { link, person, withLinks } from '../__tests__/fixtures'
import { build, dateOf } from '../__tests__/graph'
import type { NodeKey, NodeRecord } from '../domain/model'
import { orientEdges, timelineParents } from '../domain/orientation'
import { defaultDateOf } from '../domain/rules'
import { DAY_WIDTH, layoutTimeline, ROW_HEIGHT } from './timeline'

const te = (id: string): NodeKey => `trackedEntity:${id}`

const layout = async (
    records: NodeRecord[],
    seeds: string[],
    date = dateOf
) => {
    const graph = await build(records, seeds)
    const parents = timelineParents(graph, orientEdges(graph, date))
    return layoutTimeline(graph, parents, date)
}

const tree = (): NodeRecord[] =>
    withLinks(
        [
            person('A', { enrolledAt: '2026-01-01' }),
            person('B', { enrolledAt: '2026-01-03' }),
            person('C', { enrolledAt: '2026-01-06' }),
        ],
        [link('AB', 'A', 'B'), link('AC', 'A', 'C')]
    )

test('timeline x follows the date', async () => {
    const { positions, bounds } = await layout(tree(), ['A'])
    expect(positions.get(te('A'))?.x).toBe(0)
    expect(positions.get(te('B'))?.x).toBe(2 * DAY_WIDTH)
    expect(positions.get(te('C'))?.x).toBe(5 * DAY_WIDTH)
    expect(bounds).toMatchObject({ minX: 0, maxX: 5 * DAY_WIDTH })
})

test('parents sit at the mean of their children', async () => {
    const { positions } = await layout(tree(), ['A'])
    expect(positions.get(te('B'))?.y).toBe(0)
    expect(positions.get(te('C'))?.y).toBe(ROW_HEIGHT)
    expect(positions.get(te('A'))?.y).toBe(ROW_HEIGHT / 2)
})

test('trees are separated by a blank row', async () => {
    const records = [
        person('A', { enrolledAt: '2026-01-01' }),
        person('B', { enrolledAt: '2026-01-02' }),
    ]
    const { positions } = await layout(records, ['A', 'B'])
    expect(positions.get(te('A'))?.y).toBe(0)
    expect(positions.get(te('B'))?.y).toBe(2 * ROW_HEIGHT)
})

test('undated nodes sit in the no-date lane', async () => {
    const records = withLinks(
        [
            person('A', { enrolledAt: '2026-01-01' }),
            person('B', { enrolledAt: '2026-01-03' }),
            person('Z', { program: 'OtherProg' }),
        ],
        [link('AB', 'A', 'B'), link('AZ', 'A', 'Z')]
    )
    const date = defaultDateOf('FixtProg001')
    const { positions, noDateLaneX, bounds } = await layout(
        records,
        ['A'],
        date
    )
    expect(noDateLaneX).toBe(-3 * DAY_WIDTH)
    expect(positions.get(te('Z'))?.x).toBe(noDateLaneX)
    expect(positions.get(te('A'))?.x).toBe(0)
    expect(positions.get(te('B'))?.x).toBe(2 * DAY_WIDTH)
    expect(bounds.minX).toBe(noDateLaneX)
})

test('no lane or ticks without dates, one tick for a single date', async () => {
    const none = await layout(
        [person('A', { program: 'Other' })],
        ['A'],
        defaultDateOf('FixtProg001')
    )
    expect(none.ticks).toEqual([])
    expect(none.noDateLaneX).toBe(-3 * DAY_WIDTH)
    const one = await layout([person('A', { enrolledAt: '2026-01-05' })], ['A'])
    expect(one.ticks).toEqual([{ x: 0, label: '2026-01-05' }])
    expect(one.noDateLaneX).toBeUndefined()
})

test('ticks are whole days labelled in UTC', async () => {
    const { ticks } = await layout(tree(), ['A'])
    expect(ticks.map((t) => t.label)).toEqual([
        '2026-01-01',
        '2026-01-02',
        '2026-01-03',
        '2026-01-04',
        '2026-01-05',
        '2026-01-06',
    ])
    expect(ticks[5].x).toBe(5 * DAY_WIDTH)
})

test('at most 8 ticks', async () => {
    const records = withLinks(
        [
            person('A', { enrolledAt: '2026-01-01' }),
            person('B', { enrolledAt: '2026-03-15' }),
        ],
        [link('AB', 'A', 'B')]
    )
    const { ticks } = await layout(records, ['A'])
    expect(ticks).toHaveLength(8)
    expect(ticks[0].label).toBe('2026-01-01')
    expect(ticks[7].label).toBe('2026-03-15')
})
