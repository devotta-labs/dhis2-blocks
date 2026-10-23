import { sortedUnique } from './programState'

/**
 * Spec 10.1: the prefix every block keys its per-person queries under, so one
 * invalidation refreshes the person on every view. A convention: other blocks
 * write the literal rather than import it.
 */
const scope = (id: string) => ['tracked-entity', id] as const

const root = ['tracked-entity-record'] as const

export const trackedEntityRecordKeys = {
    scope,
    /** Metadata and the user's scopes only; per-person keys sit under `scope`. */
    root,
    person: (id: string) =>
        [...scope(id), 'tracked-entity-record', 'person'] as const,
    relationships: (id: string) =>
        [...scope(id), 'tracked-entity-record', 'relationships'] as const,
    programs: (ids: ReadonlyArray<string>) =>
        [...root, 'programs', sortedUnique(ids)] as const,
    trackedEntityType: (id: string) =>
        [...root, 'tracked-entity-type', id] as const,
    relationshipTypes: (ids: ReadonlyArray<string>) =>
        [...root, 'relationship-types', sortedUnique(ids)] as const,
    userScopes: () => [...root, 'user-scopes'] as const,
    orgUnitPaths: (ids: ReadonlyArray<string>) =>
        [...root, 'org-unit-paths', sortedUnique(ids)] as const,
}
