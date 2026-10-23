import { queryOptions } from '@tanstack/react-query'
import type { Result } from 'better-result'
import type { ZodType } from 'zod'
import {
    RecordRequestError,
    type RecordClient,
    type ResourceRequest,
} from './client'
import { trackedEntityRecordKeys } from './keys'
import {
    orgUnitPathsRequest,
    personRequest,
    programsRequest,
    relationshipsRequest,
    relationshipTypesRequest,
    trackedEntityTypeRequest,
    userScopesRequest,
} from './requests'
import {
    OrgUnitPathsResponseSchema,
    PersonResponseSchema,
    ProgramsResponseSchema,
    RelationshipsResponseSchema,
    RelationshipTypesResponseSchema,
    TrackedEntityTypeResponseSchema,
    UserScopesResponseSchema,
} from './schemas'

/** Metadata changes rarely: 30 minutes. Tracker queries use the host's defaults. */
export const METADATA_STALE_TIME = 30 * 60_000

const MAX_RETRIES = 2

/** What a query function needs to run one request. */
interface RequestContext {
    client: RecordClient
    request: ResourceRequest
    signal: AbortSignal
}

/** Runs the request and throws the failure, so TanStack Query sees a rejection. */
const run = async <T>(
    context: RequestContext,
    schema: ZodType<T>
): Promise<T> => {
    const result: Result<T, RecordRequestError> = await context.client.query(
        context.request,
        schema,
        context.signal
    )
    if (result.isErr()) {
        throw result.error
    }
    return result.value
}

/**
 * Retry rule for every request of the record: a status below 500 and a
 * response the schema rejected will not change on a second try; anything else
 * (5xx, no answer) gets up to two retries.
 */
export const retryRecordRequest = (failureCount: number, error: Error) => {
    if (error instanceof RecordRequestError) {
        if (error.kind === 'invalid-response') {
            return false
        }
        if (error.status !== undefined && error.status < 500) {
            return false
        }
    }
    return failureCount < MAX_RETRIES
}

export const personQuery = (client: RecordClient, id: string) =>
    queryOptions({
        queryKey: trackedEntityRecordKeys.person(id),
        retry: retryRecordRequest,
        queryFn: ({ signal }) =>
            run(
                { client, request: personRequest(id), signal },
                PersonResponseSchema
            ),
    })

export const relationshipsQuery = (client: RecordClient, id: string) =>
    queryOptions({
        queryKey: trackedEntityRecordKeys.relationships(id),
        retry: retryRecordRequest,
        queryFn: ({ signal }) =>
            run(
                { client, request: relationshipsRequest(id), signal },
                RelationshipsResponseSchema
            ),
    })

export const programsQuery = (
    client: RecordClient,
    ids: ReadonlyArray<string>
) =>
    queryOptions({
        queryKey: trackedEntityRecordKeys.programs(ids),
        retry: retryRecordRequest,
        queryFn: ({ signal }) =>
            run(
                { client, request: programsRequest(ids), signal },
                ProgramsResponseSchema
            ),
        staleTime: METADATA_STALE_TIME,
    })

export const trackedEntityTypeQuery = (client: RecordClient, id: string) =>
    queryOptions({
        queryKey: trackedEntityRecordKeys.trackedEntityType(id),
        retry: retryRecordRequest,
        queryFn: ({ signal }) =>
            run(
                { client, request: trackedEntityTypeRequest(id), signal },
                TrackedEntityTypeResponseSchema
            ),
        staleTime: METADATA_STALE_TIME,
    })

export const relationshipTypesQuery = (
    client: RecordClient,
    ids: ReadonlyArray<string>
) =>
    queryOptions({
        queryKey: trackedEntityRecordKeys.relationshipTypes(ids),
        retry: retryRecordRequest,
        queryFn: ({ signal }) =>
            run(
                { client, request: relationshipTypesRequest(ids), signal },
                RelationshipTypesResponseSchema
            ),
        staleTime: METADATA_STALE_TIME,
    })

export const userScopesQuery = (client: RecordClient) =>
    queryOptions({
        queryKey: trackedEntityRecordKeys.userScopes(),
        retry: retryRecordRequest,
        queryFn: ({ signal }) =>
            run(
                { client, request: userScopesRequest(), signal },
                UserScopesResponseSchema
            ),
        staleTime: METADATA_STALE_TIME,
    })

export const orgUnitPathsQuery = (
    client: RecordClient,
    ids: ReadonlyArray<string>
) =>
    queryOptions({
        queryKey: trackedEntityRecordKeys.orgUnitPaths(ids),
        retry: retryRecordRequest,
        queryFn: ({ signal }) =>
            run(
                { client, request: orgUnitPathsRequest(ids), signal },
                OrgUnitPathsResponseSchema
            ),
        staleTime: METADATA_STALE_TIME,
    })
