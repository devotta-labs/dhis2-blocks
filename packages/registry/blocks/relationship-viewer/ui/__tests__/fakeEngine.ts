import type {
    DataEngineLike,
    DataEngineValue,
    ResourceRequest,
} from '../../api/client'
import type { NodeRecord, NodeRef } from '../../domain/model'

const item = (ref: NodeRef) => ({ [ref.kind]: { [ref.kind]: ref.id } })

// Tracked-entity fixtures only, in the JSON shape /api/tracker returns.
const toJson = (record: NodeRecord): DataEngineValue => ({
    trackedEntity: record.ref.id,
    trackedEntityType: record.trackedEntityType,
    attributes: record.attributes.map((a) => ({ ...a })),
    enrollments: record.enrollments.map((e) => ({ ...e })),
    relationships: record.relationships.map((l) => ({
        relationship: l.relationship,
        relationshipType: l.relationshipType,
        bidirectional: l.bidirectional,
        from: item(l.from),
        to: item(l.to),
    })),
})

const constraint = {
    relationshipEntity: 'TRACKED_ENTITY_INSTANCE',
    trackerDataView: { attributes: [], dataElements: [] },
}

const relationshipType = (id: string, bidirectional: boolean) => ({
    id,
    displayName: id,
    bidirectional,
    fromConstraint: constraint,
    toConstraint: constraint,
})

/**
 * Serves fixture records by id, seed pages from `seeds`, and metadata for the `exposed` and `contact` types.
 * `fail` holds record ids or resource names answered with a 404; tests mutate it to recover.
 */
export const fakeEngine = (
    records: readonly NodeRecord[],
    opts: { seeds?: readonly NodeRecord[]; fail?: readonly string[] } = {}
) => {
    const fail = new Set(opts.fail)
    const calls: string[] = []
    const requests: ResourceRequest[] = []

    const respond = (request: ResourceRequest) => {
        const { resource, id, params } = request
        requests.push(request)
        calls.push(
            id ? `${resource}/${id}` : `${resource}?page=${params?.page}`
        )
        if (fail.has(id ?? resource)) {
            throw { status: 404 }
        }
        if (resource === 'relationshipTypes') {
            return {
                relationshipTypes: [
                    relationshipType('exposed', false),
                    relationshipType('contact', true),
                ],
            }
        }
        if (resource === 'trackedEntityTypes') {
            return { trackedEntityTypes: [{ id: 'FixtTeType1' }] }
        }
        if (!id) {
            const page = Number(params?.page)
            const size = Number(params?.pageSize)
            return {
                trackedEntities: (opts.seeds ?? [])
                    .slice((page - 1) * size, page * size)
                    .map(toJson),
            }
        }
        const record = records.find((r) => r.ref.id === id)
        if (!record) {
            throw { status: 404 }
        }
        return toJson(record)
    }

    const engine: DataEngineLike = {
        query: async (query) =>
            Object.fromEntries(
                Object.entries(query).map(([key, request]) => [
                    key,
                    respond(request),
                ])
            ),
    }

    const nodeCalls = (id: string) =>
        calls.filter((c) => c === `tracker/trackedEntities/${id}`).length

    return { engine, calls, requests, fail, nodeCalls }
}
