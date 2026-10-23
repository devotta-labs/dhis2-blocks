const root = ['tracked-entity-record'] as const

/** The same set of ids always maps to the same key, whatever order it came in. */
const sortedUnique = (ids: ReadonlyArray<string>) => [...new Set(ids)].sort()

export const trackedEntityRecordKeys = {
    root,
    person: (id: string) => [...root, 'person', id] as const,
    relationships: (id: string) =>
        [...root, 'person', id, 'relationships'] as const,
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
