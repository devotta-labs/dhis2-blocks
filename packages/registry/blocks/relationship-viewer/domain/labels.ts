import type {
    NodeKey,
    NodeRecord,
    RelationshipEdge,
    RelationshipGraph,
    RelationshipNode,
} from './model'

type RelationshipEntity =
    | 'TRACKED_ENTITY_INSTANCE'
    | 'PROGRAM_INSTANCE'
    | 'PROGRAM_STAGE_INSTANCE'

export interface ConstraintMeta {
    relationshipEntity: RelationshipEntity
    trackerDataView: {
        attributes: readonly string[]
        dataElements: readonly string[]
    }
}

interface RelationshipTypeMeta {
    id: string
    displayName: string
    bidirectional: boolean
    fromToName?: string
    toFromName?: string
    from: ConstraintMeta
    to: ConstraintMeta
}

export interface RelationshipMetadata {
    types: ReadonlyMap<string, RelationshipTypeMeta>
    /** Tracked entity type to its displayInList attribute UIDs. */
    trackedEntityTypeDisplayAttributes: ReadonlyMap<string, readonly string[]>
}

const join = (
    record: NodeRecord,
    isEvent: boolean,
    uids: readonly string[]
): string => {
    const values = new Map<string, string>(
        isEvent
            ? record.dataValues.map((v) => [v.dataElement, v.value])
            : record.attributes.map((a) => [a.attribute, a.value])
    )
    return uids
        .flatMap((uid) => values.get(uid) ?? [])
        .filter(Boolean)
        .join(' · ')
}

function labelOf(
    node: RelationshipNode,
    edge: RelationshipEdge | undefined,
    metadata: RelationshipMetadata
): string {
    if (node.state.status !== 'loaded') {
        return node.ref.id
    }
    const { record } = node.state
    const isEvent = node.ref.kind === 'event'
    const type = edge && metadata.types.get(edge.type)
    const side = edge?.from === node.key ? type?.from : type?.to
    const view = side?.trackerDataView
    const configured = view
        ? join(record, isEvent, isEvent ? view.dataElements : view.attributes)
        : ''
    const display = record.trackedEntityType
        ? join(
              record,
              false,
              metadata.trackedEntityTypeDisplayAttributes.get(
                  record.trackedEntityType
              ) ?? []
          )
        : ''
    return configured || display || node.ref.id
}

/** Every node's label: its data view on the side of the link it was found through, or a starting record's first link. */
export function labelsOf(
    graph: RelationshipGraph,
    metadata: RelationshipMetadata
): Map<NodeKey, string> {
    const firstLink = new Map<NodeKey, RelationshipEdge>()
    for (const edge of graph.edges.values()) {
        if (!firstLink.has(edge.from)) firstLink.set(edge.from, edge)
        if (!firstLink.has(edge.to)) firstLink.set(edge.to, edge)
    }
    return new Map(
        [...graph.nodes.values()].map((node) => [
            node.key,
            labelOf(
                node,
                (node.discoveredVia
                    ? graph.edges.get(node.discoveredVia)
                    : undefined) ?? firstLink.get(node.key),
                metadata
            ),
        ])
    )
}
