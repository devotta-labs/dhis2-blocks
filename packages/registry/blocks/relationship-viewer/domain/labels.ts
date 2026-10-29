import type { NodeRecord, RelationshipGraph, RelationshipNode } from './model'

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

export function defaultLabel(
    node: RelationshipNode,
    graph: RelationshipGraph,
    metadata: RelationshipMetadata
): string {
    if (node.state.status !== 'loaded') {
        return node.ref.id
    }
    const { record } = node.state
    const isEvent = node.ref.kind === 'event'
    const edge =
        (node.discoveredVia
            ? graph.edges.get(node.discoveredVia)
            : undefined) ??
        [...graph.edges.values()].find(
            (e) => e.from === node.key || e.to === node.key
        )
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
