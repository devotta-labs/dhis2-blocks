export type NodeKind = 'trackedEntity' | 'enrollment' | 'event'
export interface NodeRef {
    kind: NodeKind
    id: string
}
export type NodeKey = `${NodeKind}:${string}`

export const nodeKey = (ref: NodeRef): NodeKey => `${ref.kind}:${ref.id}`

export const parseNodeKey = (key: NodeKey): NodeRef => {
    const split = key.indexOf(':')
    // SAFETY: NodeKey is built by nodeKey, so the prefix is always a NodeKind.
    return {
        kind: key.slice(0, split) as NodeKind,
        id: key.slice(split + 1),
    }
}

export interface RelationshipLink {
    relationship: string
    relationshipType: string
    bidirectional: boolean
    createdAt?: string
    from: NodeRef
    to: NodeRef
}

export type EnrollmentStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED'

export interface RecordEnrollment {
    enrollment: string
    program: string
    status: EnrollmentStatus
    followUp: boolean
    enrolledAt?: string
    occurredAt?: string
}

export interface NodeRecord {
    ref: NodeRef
    trackedEntityType?: string
    program?: string
    programStage?: string
    occurredAt?: string
    attributes: readonly {
        attribute: string
        displayName?: string
        value: string
    }[]
    dataValues: readonly { dataElement: string; value: string }[]
    enrollments: readonly RecordEnrollment[]
    relationships: readonly RelationshipLink[]
    /** Relationships whose other side DHIS2 did not name; counted as other links. */
    unresolvedLinkCount?: number
}

export type NodeState =
    | { status: 'loaded'; record: NodeRecord }
    | { status: 'failed'; error: unknown }

export interface RelationshipNode {
    key: NodeKey
    ref: NodeRef
    hop: number
    seed: boolean
    state: NodeState
    stubCount: number
    otherLinkCount: number
    discoveredVia?: string // relationship UID
}

export interface RelationshipEdge {
    id: string
    type: string
    bidirectional: boolean
    createdAt?: string
    from: NodeKey
    to: NodeKey
}

export interface RelationshipGraph {
    nodes: ReadonlyMap<NodeKey, RelationshipNode>
    edges: ReadonlyMap<string, RelationshipEdge>
    order: readonly NodeKey[] // breadth-first discovery order
    capped: boolean
}

export type FetchRecord = (ref: NodeRef) => Promise<NodeRecord>

export interface RelationshipStatus {
    key: string
    label: string
    color: string
    attention?: boolean
    size?: 'small' | 'large'
}

export type DateOf = (node: RelationshipNode) => Date | undefined
