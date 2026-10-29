import {
    chains,
    link,
    person,
    superspreaders,
    withLinks,
} from '../__tests__/fixtures'
import { nodeKey, parseNodeKey } from './model'

test('node keys round-trip', () => {
    expect(nodeKey({ kind: 'event', id: 'Evt00000001' })).toBe(
        'event:Evt00000001'
    )
    expect(parseNodeKey('trackedEntity:Tei00000001')).toEqual({
        kind: 'trackedEntity',
        id: 'Tei00000001',
    })
})
test('fixtures attach each link to both ends', () => {
    const [a, b] = withLinks([person('A'), person('B')], [link('r1', 'A', 'B')])
    expect(a.relationships.map((l) => l.relationship)).toEqual(['r1'])
    expect(b.relationships.map((l) => l.relationship)).toEqual(['r1'])
    expect(chains()).toHaveLength(48)
    expect(superspreaders()).toHaveLength(39)
})
