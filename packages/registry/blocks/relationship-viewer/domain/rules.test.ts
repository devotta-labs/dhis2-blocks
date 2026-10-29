import { FIXTURE_PROGRAM, person } from '../__tests__/fixtures'
import { build } from '../__tests__/graph'
import type { NodeRecord, RelationshipNode } from './model'
import {
    defaultDateOf,
    enrollmentFor,
    enrollmentStatus,
    isMarkedForFollowUp,
} from './rules'

const nodeOf = async (record: NodeRecord): Promise<RelationshipNode> => {
    const graph = await build([record], [record.ref.id])
    return graph.nodes.get(`${record.ref.kind}:${record.ref.id}`)!
}

test('helpers without an enrollment', async () => {
    const node = await nodeOf(person('A', { program: 'Other' }))
    expect(enrollmentFor(node, FIXTURE_PROGRAM)).toBeUndefined()
    expect(isMarkedForFollowUp(node, FIXTURE_PROGRAM)).toBe(false)
    expect(enrollmentStatus(node, FIXTURE_PROGRAM)).toBeUndefined()
    expect(defaultDateOf(FIXTURE_PROGRAM)(node)).toBeUndefined()
})

test("follow-up flag and status come from the program's enrollment", async () => {
    const node = await nodeOf(
        person('A', { followUp: true, enrolledAt: '2026-02-03' })
    )
    expect(enrollmentFor(node, FIXTURE_PROGRAM)?.enrollment).toBe(
        'A-enrollment'
    )
    expect(isMarkedForFollowUp(node, FIXTURE_PROGRAM)).toBe(true)
    expect(enrollmentStatus(node, FIXTURE_PROGRAM)).toBe('ACTIVE')
    expect(defaultDateOf(FIXTURE_PROGRAM)(node)).toEqual(new Date('2026-02-03'))
    expect(defaultDateOf()(node)).toEqual(new Date('2026-02-03'))
})

test('unparseable dates give undefined', async () => {
    const node = await nodeOf(person('A', { enrolledAt: 'not a date' }))
    expect(defaultDateOf()(node)).toBeUndefined()
})

test('events date by occurredAt', () => {
    const record: NodeRecord = {
        ref: { kind: 'event', id: 'E1' },
        occurredAt: '2026-03-04',
        attributes: [],
        dataValues: [],
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
    expect(defaultDateOf(FIXTURE_PROGRAM)(node)).toEqual(new Date('2026-03-04'))
})
