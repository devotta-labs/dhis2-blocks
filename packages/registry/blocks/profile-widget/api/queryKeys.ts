import type { TrackedEntityChangelogOrder } from '../types'

const sortedUnique = (ids: readonly string[]) => [...new Set(ids)].sort()

export const profileWidgetQueryKeys = {
    all: ['profile-widget'] as const,

    trackedEntity: (trackedEntityId: string) =>
        [
            ...profileWidgetQueryKeys.all,
            'tracked-entity',
            trackedEntityId,
        ] as const,
    trackedEntityRecord: (trackedEntityId: string, programId: string | null) =>
        [
            ...profileWidgetQueryKeys.trackedEntity(trackedEntityId),
            'record',
            programId ?? 'no-program',
        ] as const,
    changelogs: (trackedEntityId: string) =>
        [
            ...profileWidgetQueryKeys.trackedEntity(trackedEntityId),
            'changelog',
        ] as const,
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
    programMetadata: (programId: string, minorVersion: number) =>
        [
            ...profileWidgetQueryKeys.metadata(),
            'program',
            programId,
            minorVersion,
        ] as const,
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
