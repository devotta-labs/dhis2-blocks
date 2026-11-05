import type { ResourceRequest } from '../api/client'
import {
    CanonicalValueSchema,
    canonicalizeValue,
} from '../domain/canonicalValue'
const canonicalizeRecordRequest = (request: ResourceRequest) =>
    canonicalizeValue(CanonicalValueSchema.parse(request))

export const workingListQueryKeys = {
    all: ['working-list'] as const,
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
    recordRequest: (request: ResourceRequest) =>
        [
            ...workingListQueryKeys.all,
            'records',
            canonicalizeRecordRequest(request),
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
