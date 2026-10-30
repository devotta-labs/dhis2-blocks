import { chains, cycle, link, person, withLinks } from '../__tests__/fixtures'
import { build, dateOf } from '../__tests__/graph'
import type { NodeKey, NodeRecord } from '../domain/model'
import { generations, orientEdges, parentsOf } from '../domain/orientation'
import {
    CARD_HEIGHT,
    CARD_WIDTH,
    COLUMN_GAP,
    elbowPath,
    layoutTrace,
    ROW_GAP,
} from './trace'

const te = (id: string): NodeKey => `trackedEntity:${id}`
const COLUMN = CARD_WIDTH + COLUMN_GAP
const ROW = CARD_HEIGHT + ROW_GAP

const layout = async (records: NodeRecord[], seeds: string[], hops = 10) => {
    const graph = await build(records, seeds, hops)
    const orientation = orientEdges(graph, dateOf)
    return layoutTrace(
        graph,
        parentsOf(graph, orientation),
        generations(graph, orientation)
    )
}

const tree = (): NodeRecord[] =>
    withLinks(
        ['A', 'B', 'C'].map((id) => person(id)),
        [link('AB', 'A', 'B'), link('AC', 'A', 'C')]
    )

test('columns follow generations', async () => {
    const { positions } = await layout(chains(), ['A1'], 3)
    expect(positions.get(te('A1'))?.x).toBe(0)
    expect(positions.get(te('A1c'))?.x).toBe(COLUMN)
    expect(positions.get(te('A2'))?.x).toBe(COLUMN)
    expect(positions.get(te('A3'))?.x).toBe(2 * COLUMN)
})

test('parents sit at the mean of their children', async () => {
    const { positions } = await layout(tree(), ['A'])
    expect(positions.get(te('B'))?.y).toBe(0)
    expect(positions.get(te('C'))?.y).toBe(ROW)
    expect(positions.get(te('A'))?.y).toBe(ROW / 2)
})

test('trees are separated by a blank row', async () => {
    const { positions } = await layout([person('A'), person('B')], ['A', 'B'])
    expect(positions.get(te('A'))?.y).toBe(0)
    expect(positions.get(te('B'))?.y).toBe(2 * ROW)
})

test('trace places a cycle with finite coordinates', async () => {
    const { positions } = await layout(cycle(), ['C1'])
    expect(positions.size).toBe(3)
    for (const { x, y } of positions.values()) {
        expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true)
    }
})

test('bounds cover whole cards', async () => {
    const { bounds } = await layout([person('L')], ['L'])
    expect(bounds).toEqual({
        minX: -CARD_WIDTH / 2,
        maxX: CARD_WIDTH / 2,
        minY: -CARD_HEIGHT / 2,
        maxY: CARD_HEIGHT / 2,
    })
})

test('elbowPath steps right to a later column', () => {
    expect(elbowPath({ x: 0, y: 0 }, { x: 240, y: 68 })).toBe(
        'M88,0 H120 V68 H152'
    )
})

test('elbowPath brackets a link that does not go right', () => {
    expect(elbowPath({ x: 0, y: 0 }, { x: 0, y: 68 })).toBe(
        'M88,0 H104 V68 H88'
    )
})
