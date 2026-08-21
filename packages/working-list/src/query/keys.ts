import type { ResourceRequest } from '../api/client'
import {
    CanonicalValueSchema,
    canonicalizeValue,
} from '../domain/canonicalValue'
import type {
    WorkingListConfiguration,
    WorkingListContext,
    WorkingListPagination,
} from '../domain/model'

interface WorkingListRecordKeyInput {
    context: WorkingListContext
    configuration: WorkingListConfiguration
    pagination: WorkingListPagination
}

const canonicalizeRecordKey = (value: WorkingListRecordKeyInput) =>
    canonicalizeValue(CanonicalValueSchema.parse(value))

const canonicalizeRecordRequest = (request: ResourceRequest) =>
    canonicalizeValue(CanonicalValueSchema.parse(request))

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
            canonicalizeRecordKey({ context, configuration, pagination }),
        ] as const,
    recordRequest: (request: ResourceRequest) =>
        [
            ...workingListQueryKeys.all,
            'records',
            canonicalizeRecordRequest(request),
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
    fileResourceNames: (ids: string[]) =>
        [
            ...workingListQueryKeys.all,
            'reference-labels',
            'file-resources',
            [...new Set(ids)].sort(),
        ] as const,
}
