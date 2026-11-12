import type { ResourceRequest } from '../api/request'
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
    /** The program and system settings as the list reads them, per locale. */
    metadata: (
        programId: string,
        apiVersion: number | undefined,
        locale: string
    ) =>
        [
            ...workingListQueryKeys.all,
            'metadata',
            'resolved',
            programId,
            apiVersion ?? 'unknown',
            locale,
        ] as const,
    savedLists: (programId: string) =>
        [...workingListQueryKeys.all, 'saved-lists', programId] as const,
    /** One key for every saved-list write, so any of them can lock the controls. */
    savedListMutations: (programId: string) =>
        [
            ...workingListQueryKeys.all,
            'saved-list-mutations',
            programId,
        ] as const,
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
