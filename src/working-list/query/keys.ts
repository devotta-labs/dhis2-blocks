import type { ResourceRequest } from '../api/client'
import type {
    WorkingListConfiguration,
    WorkingListContext,
    WorkingListPagination,
} from '../domain/model'

const canonicalize = (value: unknown): unknown => {
    if (Array.isArray(value)) {
        return value.map(canonicalize)
    }
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
                .filter(([, entry]) => entry !== undefined)
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([key, entry]) => [key, canonicalize(entry)])
        )
    }
    return value
}

export const workingListQueryKeys = {
    all: ['working-list'] as const,
    capabilities: (apiVersion: number) =>
        [...workingListQueryKeys.all, 'capabilities', apiVersion] as const,
    systemInfo: () =>
        [...workingListQueryKeys.all, 'metadata', 'system-info'] as const,
    programMetadata: (programId: string, apiVersion?: number) =>
        [
            ...workingListQueryKeys.all,
            'metadata',
            'program',
            programId,
            apiVersion ?? 'runtime',
        ] as const,
    savedLists: (programId: string) =>
        [...workingListQueryKeys.all, 'saved-lists', programId] as const,
    records: (
        context: WorkingListContext,
        configuration: WorkingListConfiguration,
        pagination: WorkingListPagination
    ) =>
        [
            ...workingListQueryKeys.all,
            'records',
            canonicalize({ context, configuration, pagination }),
        ] as const,
    recordRequest: (request: ResourceRequest) =>
        [
            ...workingListQueryKeys.all,
            'records',
            canonicalize(request),
        ] as const,
    trackedEntityJoin: (programId: string, trackedEntityIds: string[]) =>
        [
            ...workingListQueryKeys.all,
            'tracked-entity-join',
            programId,
            [...new Set(trackedEntityIds)].sort(),
        ] as const,
    organisationUnitLabels: (ids: string[]) =>
        [
            ...workingListQueryKeys.all,
            'reference-labels',
            'organisation-units',
            [...new Set(ids)].sort(),
        ] as const,
}
