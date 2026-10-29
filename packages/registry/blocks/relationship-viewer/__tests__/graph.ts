import type {
    DateOf,
    NodeRecord,
    RelationshipGraph,
    RelationshipNode,
} from '../domain/model'
import { traverse } from '../domain/traverse'
import { fakeFetch } from './fixtures'

export const dateOf: DateOf = (node: RelationshipNode) => {
    const at =
        node.state.status === 'loaded'
            ? node.state.record.enrollments[0]?.enrolledAt
            : undefined
    return at ? new Date(at) : undefined
}

export const build = (
    records: NodeRecord[],
    seedIds: string[],
    hops = 10
): Promise<RelationshipGraph> =>
    traverse(
        seedIds.map((id) => ({ kind: 'trackedEntity' as const, id })),
        fakeFetch(records),
        { hops, cap: 500, concurrency: 6 }
    )
