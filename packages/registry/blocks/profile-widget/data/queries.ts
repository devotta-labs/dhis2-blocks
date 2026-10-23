import { queryOptions } from '@tanstack/react-query'
import {
    shouldRetryProfileWidgetRequest,
    type ProfileWidgetClient,
} from '../api/client'
import { isQueryNotDeleted } from '../api/deletedQueries'
import { profileWidgetQueryKeys } from '../api/queryKeys'
import {
    fetchAuthorities,
    fetchProgramMetadata,
    fetchSystemInfo,
    fetchTrackedEntityRecord,
    fetchTrackedEntityTypeMetadata,
} from '../api/requests'
import type { ProfileServerFeatures } from '../api/serverVersion'

/*
 * Query options for the profile. Metadata, system info and authorities use
 * `staleTime: Infinity`. `systemInfoQueryOptions` is shared with the
 * formatting pipeline (and therefore the changelog).
 */

export const programMetadataQueryOptions = (
    client: ProfileWidgetClient,
    input: { programId: string; features: ProfileServerFeatures }
) =>
    queryOptions({
        queryKey: profileWidgetQueryKeys.programMetadata(
            input.programId,
            input.features.minorVersion
        ),
        queryFn: ({ signal }) => fetchProgramMetadata(client, input, signal),
        staleTime: Infinity,
        retry: shouldRetryProfileWidgetRequest,
    })

export const trackedEntityTypeMetadataQueryOptions = (
    client: ProfileWidgetClient,
    input: { trackedEntityTypeId: string; features: ProfileServerFeatures }
) =>
    queryOptions({
        queryKey: profileWidgetQueryKeys.trackedEntityTypeMetadata(
            input.trackedEntityTypeId,
            input.features.minorVersion
        ),
        queryFn: ({ signal }) =>
            fetchTrackedEntityTypeMetadata(client, input, signal),
        staleTime: Infinity,
        retry: shouldRetryProfileWidgetRequest,
    })

export const trackedEntityRecordQueryOptions = (
    client: ProfileWidgetClient,
    input: { trackedEntityId: string; programId: string | null }
) =>
    queryOptions({
        queryKey: profileWidgetQueryKeys.trackedEntityRecord(
            input.trackedEntityId,
            input.programId
        ),
        queryFn: ({ signal }) =>
            fetchTrackedEntityRecord(client, input, signal),
        retry: shouldRetryProfileWidgetRequest,
        // Never refetch a deleted entity that a mounted profile still shows.
        enabled: isQueryNotDeleted,
    })

export const systemInfoQueryOptions = (client: ProfileWidgetClient) =>
    queryOptions({
        queryKey: profileWidgetQueryKeys.systemInfo(),
        queryFn: ({ signal }) => fetchSystemInfo(client, signal),
        staleTime: Infinity,
        retry: shouldRetryProfileWidgetRequest,
    })

export const authoritiesQueryOptions = (client: ProfileWidgetClient) =>
    queryOptions({
        queryKey: profileWidgetQueryKeys.authorities(),
        queryFn: ({ signal }) => fetchAuthorities(client, signal),
        staleTime: Infinity,
        retry: shouldRetryProfileWidgetRequest,
    })
