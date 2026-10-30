import { link, person, withLinks } from '../__tests__/fixtures'
import { build } from '../__tests__/graph'
import { labelsOf } from './labels'
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
    expect(labelsOf(graph, metadata(['last', 'first'], [])).get(node.key)).toBe(
        'Lovelace · Ada'
    )
})

test('label uses the side the node matched', async () => {
    const graph = await graphOf({ name: 'Ada', phone: '555' })
    const meta = metadata(['name'], ['phone'])
    expect(labelsOf(graph, meta).get('trackedEntity:A')).toBe('Ada')
    expect(labelsOf(graph, meta).get('trackedEntity:B')).toBe('555')
})

test('missing values are skipped', async () => {
    const graph = await graphOf({ last: 'Lovelace' })
    const node = graph.nodes.get('trackedEntity:A')!
    expect(labelsOf(graph, metadata(['first', 'last'], [])).get(node.key)).toBe(
        'Lovelace'
    )
})

test('falls back to tracked entity type display attributes', async () => {
    const graph = await graphOf({ nick: 'Countess' })
    const node = graph.nodes.get('trackedEntity:A')!
    expect(
        labelsOf(graph, metadata(['absent'], [], ['nick'])).get(node.key)
    ).toBe('Countess')
})

test('falls back to the UID', async () => {
    const graph = await graphOf({})
    const node = graph.nodes.get('trackedEntity:A')!
    expect(labelsOf(graph, metadata(['absent'], [])).get(node.key)).toBe('A')
})

test('a failed node is labelled by its UID', async () => {
    const graph = await build(
        withLinks([person('A')], [link('A-B', 'A', 'B')]),
        ['A']
    )
    const node = graph.nodes.get('trackedEntity:B')!
    expect(node.state.status).toBe('failed')
    expect(labelsOf(graph, metadata([], ['x'])).get(node.key)).toBe('B')
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
    expect(labelsOf(graph, withEvent).get(node.key)).toBe('High · Fever')
})
