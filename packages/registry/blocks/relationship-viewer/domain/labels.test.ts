import { link, person, withLinks } from '../__tests__/fixtures'
import { build } from '../__tests__/graph'
import { defaultLabel } from './labels'
import type { ConstraintMeta, RelationshipMetadata } from './labels'
import type { NodeRecord, RelationshipGraph, RelationshipNode } from './model'

const constraint = (attributes: string[]): ConstraintMeta => ({
    relationshipEntity: 'TRACKED_ENTITY_INSTANCE',
    trackerDataView: { attributes, dataElements: [] },
})

const metadata = (
    from: string[],
    to: string[],
    displayAttributes: string[] = []
): RelationshipMetadata => ({
    types: new Map([
        [
            'exposed',
            {
                id: 'exposed',
                displayName: 'Exposed',
                bidirectional: false,
                from: constraint(from),
                to: constraint(to),
            },
        ],
    ]),
    trackedEntityTypeDisplayAttributes: new Map([
        ['FixtTeType1', displayAttributes],
    ]),
})

const graphOf = (attributes: Record<string, string>) =>
    build(
        withLinks(
            [person('A', { attributes }), person('B', { attributes })],
            [link('A-B', 'A', 'B')]
        ),
        ['A']
    )

test('label follows the trackerDataView order', async () => {
    const graph = await graphOf({ first: 'Ada', last: 'Lovelace' })
    const node = graph.nodes.get('trackedEntity:A')!
    expect(defaultLabel(node, graph, metadata(['last', 'first'], []))).toBe(
        'Lovelace · Ada'
    )
})

test('label uses the side the node matched', async () => {
    const graph = await graphOf({ name: 'Ada', phone: '555' })
    const meta = metadata(['name'], ['phone'])
    expect(defaultLabel(graph.nodes.get('trackedEntity:A')!, graph, meta)).toBe(
        'Ada'
    )
    expect(defaultLabel(graph.nodes.get('trackedEntity:B')!, graph, meta)).toBe(
        '555'
    )
})

test('missing values are skipped', async () => {
    const graph = await graphOf({ last: 'Lovelace' })
    const node = graph.nodes.get('trackedEntity:A')!
    expect(defaultLabel(node, graph, metadata(['first', 'last'], []))).toBe(
        'Lovelace'
    )
})

test('falls back to tracked entity type display attributes', async () => {
    const graph = await graphOf({ nick: 'Countess' })
    const node = graph.nodes.get('trackedEntity:A')!
    expect(defaultLabel(node, graph, metadata(['absent'], [], ['nick']))).toBe(
        'Countess'
    )
})

test('falls back to the UID', async () => {
    const graph = await graphOf({})
    const node = graph.nodes.get('trackedEntity:A')!
    expect(defaultLabel(node, graph, metadata(['absent'], []))).toBe('A')
})

test('a failed node is labelled by its UID', async () => {
    const graph = await build(
        withLinks([person('A')], [link('A-B', 'A', 'B')]),
        ['A']
    )
    const node = graph.nodes.get('trackedEntity:B')!
    expect(node.state.status).toBe('failed')
    expect(defaultLabel(node, graph, metadata([], ['x']))).toBe('B')
})

test('events label from data values', () => {
    const record: NodeRecord = {
        ref: { kind: 'event', id: 'E1' },
        attributes: [],
        dataValues: [
            { dataElement: 'de1', value: 'Fever' },
            { dataElement: 'de2', value: 'High' },
        ],
        enrollments: [],
        relationships: [],
    }
    const node: RelationshipNode = {
        key: 'event:E1',
        ref: record.ref,
        hop: 0,
        seed: true,
        state: { status: 'loaded', record },
        stubCount: 0,
        otherLinkCount: 0,
    }
    const graph: RelationshipGraph = {
        nodes: new Map([[node.key, node]]),
        edges: new Map([
            [
                'E1-A',
                {
                    id: 'E1-A',
                    type: 'exposed',
                    bidirectional: false,
                    from: 'event:E1',
                    to: 'trackedEntity:A',
                },
            ],
        ]),
        order: [node.key],
        capped: false,
    }
    const meta = metadata([], [])
    const exposed = meta.types.get('exposed')!
    const withEvent: RelationshipMetadata = {
        ...meta,
        types: new Map([
            [
                'exposed',
                {
                    ...exposed,
                    from: {
                        relationshipEntity: 'PROGRAM_STAGE_INSTANCE',
                        trackerDataView: {
                            attributes: [],
                            dataElements: ['de2', 'de1'],
                        },
                    },
                },
            ],
        ]),
    }
    expect(defaultLabel(node, graph, withEvent)).toBe('High · Fever')
})
