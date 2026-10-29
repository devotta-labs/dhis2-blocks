import type { SeedQuery } from '../api/fetchers'
import type { RelationshipMetadata } from '../domain/labels'
import type {
    DateOf,
    NodeKey,
    NodeRef,
    RelationshipGraph,
    RelationshipNode,
    RelationshipStatus,
} from '../domain/model'
import type { Orientation } from '../domain/orientation'
import type { OutbreakSummary } from '../domain/summary'

export type RelationshipViewerLayout = 'web' | 'timeline'

export type RelationshipViewerSeeds =
    | { refs: readonly NodeRef[] }
    | { query: SeedQuery }

export type RelationshipViewerStatus = 'loading' | 'ready' | 'error'

export interface RelationshipViewerState {
    status: RelationshipViewerStatus
    error?: unknown
    graph?: RelationshipGraph
    layout: RelationshipViewerLayout
    selected?: NodeKey
}

export interface RelationshipViewerActions {
    setLayout(layout: RelationshipViewerLayout): void
    select(key: NodeKey | undefined): void
    expand(key: NodeKey): void
    /** Retries one failed node, or everything that failed when `key` is undefined. */
    retry(key?: NodeKey): void
}

export interface RelationshipViewerMeta {
    statuses: readonly RelationshipStatus[]
    statusOf(node: RelationshipNode): RelationshipStatus | undefined
    labelOf(node: RelationshipNode): string
    dateOf: DateOf
    orientation: ReadonlyMap<string, Orientation>
    generations: ReadonlyMap<NodeKey, number>
    summary: OutbreakSummary
    cap: number
}

export interface RelationshipGraphResult {
    status: RelationshipViewerStatus
    error?: unknown
    graph?: RelationshipGraph
    metadata?: RelationshipMetadata
    /** The program every node is read with: the `program` option, else the seed query's. */
    program: string | undefined
    expand(key: NodeKey): void
    retry(key?: NodeKey): void
}
