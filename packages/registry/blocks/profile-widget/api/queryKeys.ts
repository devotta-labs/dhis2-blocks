import type { TrackedEntityChangelogOrder } from '../types'

const sortedUnique = (ids: readonly string[]) => [...new Set(ids)].sort()

/**
 * Every query the block owns lives under `['profile-widget', …]`.
 *
 * - `trackedEntity(id)` is the prefix for everything that belongs to one
 *   entity (its record and its changelog pages). Invalidate it after a status
 *   change; remove it after a delete.
 * - Metadata, system info and authorities are entity-independent and cached
 *   with `staleTime: Infinity` by their query options.
 */
export const profileWidgetQueryKeys = {
    all: ['profile-widget'] as const,

    /** Prefix for one tracked entity's record and changelog queries. */
    trackedEntity: (trackedEntityId: string) =>
        [
            ...profileWidgetQueryKeys.all,
            'tracked-entity',
            trackedEntityId,
        ] as const,
    /** `tracker/trackedEntities/{id}` (profile fields), per program scope. */
    trackedEntityRecord: (trackedEntityId: string, programId: string | null) =>
        [
            ...profileWidgetQueryKeys.trackedEntity(trackedEntityId),
            'record',
            programId ?? 'no-program',
        ] as const,
    /** Prefix for all changelog pages of one tracked entity. */
    changelogs: (trackedEntityId: string) =>
        [
            ...profileWidgetQueryKeys.trackedEntity(trackedEntityId),
            'changelog',
        ] as const,
    /** One changelog page. */
    changelog: (
        trackedEntityId: string,
        params: {
            programId: string | null
            page: number
            pageSize: number
            attributeId: string | null
            order: TrackedEntityChangelogOrder | null
        }
    ) =>
        [
            ...profileWidgetQueryKeys.changelogs(trackedEntityId),
            params.programId ?? 'no-program',
            params.page,
            params.pageSize,
            params.attributeId ?? 'all-attributes',
            params.order
                ? `${params.order.column}:${params.order.direction}`
                : 'default-order',
        ] as const,

    metadata: () => [...profileWidgetQueryKeys.all, 'metadata'] as const,
    /** `programs/{id}`; the field list depends on the server minor version. */
    programMetadata: (programId: string, minorVersion: number) =>
        [
            ...profileWidgetQueryKeys.metadata(),
            'program',
            programId,
            minorVersion,
        ] as const,
    /** `trackedEntityTypes/{id}` (no-program mode). */
    trackedEntityTypeMetadata: (
        trackedEntityTypeId: string,
        minorVersion: number
    ) =>
        [
            ...profileWidgetQueryKeys.metadata(),
            'tracked-entity-type',
            trackedEntityTypeId,
            minorVersion,
        ] as const,
    systemInfo: () =>
        [...profileWidgetQueryKeys.metadata(), 'system-info'] as const,
    authorities: () =>
        [...profileWidgetQueryKeys.all, 'me', 'authorities'] as const,

    lookups: () => [...profileWidgetQueryKeys.all, 'lookups'] as const,
    fileResourceNames: (fileResourceIds: readonly string[]) =>
        [
            ...profileWidgetQueryKeys.lookups(),
            'file-resources',
            sortedUnique(fileResourceIds),
        ] as const,
    organisationUnits: (organisationUnitIds: readonly string[]) =>
        [
            ...profileWidgetQueryKeys.lookups(),
            'organisation-units',
            sortedUnique(organisationUnitIds),
        ] as const,
}
