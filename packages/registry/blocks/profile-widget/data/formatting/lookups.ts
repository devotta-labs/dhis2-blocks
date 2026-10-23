import { queryOptions } from '@tanstack/react-query'
import {
    getRequestStatus,
    shouldRetryProfileWidgetRequest,
    type ProfileWidgetClient,
} from '../../api/client'
import { profileWidgetQueryKeys } from '../../api/queryKeys'
import {
    FileResourceSchema,
    ORGANISATION_UNIT_LOOKUP_FIELDS,
    OrganisationUnitsResponseSchema,
} from '../../api/schemas'
import type { FormattableValue } from './contracts'

export interface OrganisationUnitLookup {
    name: string
    path: readonly string[]
}

export interface LookupIds {
    fileResourceIds: readonly string[]
    organisationUnitIds: readonly string[]
}

const ORGANISATION_UNIT_BATCH_SIZE = 50

const LOOKUP_STALE_TIME = 60 * 60_000

const sortedUnique = (ids: Iterable<string>) => [...new Set(ids)].sort()

export const collectLookupIds = (
    values: readonly FormattableValue[]
): LookupIds => {
    const fileResourceIds: string[] = []
    const organisationUnitIds: string[] = []
    for (const value of values) {
        if (!value.rawValue || value.options) continue
        if (value.valueType === 'FILE_RESOURCE') {
            fileResourceIds.push(value.rawValue)
        } else if (value.valueType === 'ORGANISATION_UNIT') {
            organisationUnitIds.push(value.rawValue)
        }
    }
    return {
        fileResourceIds: sortedUnique(fileResourceIds),
        organisationUnitIds: sortedUnique(organisationUnitIds),
    }
}

const fetchFileResourceNames = async (
    client: ProfileWidgetClient,
    fileResourceIds: readonly string[],
    signal?: AbortSignal
): Promise<ReadonlyMap<string, string>> => {
    const entries = await Promise.all(
        sortedUnique(fileResourceIds).map(async (id) => {
            try {
                const resource = await client.query(
                    {
                        resource: 'fileResources',
                        id,
                        params: { fields: 'id,displayName' },
                    },
                    FileResourceSchema,
                    signal
                )
                return [id, resource.displayName] as const
            } catch (cause) {
                const status = getRequestStatus(cause)
                if (signal?.aborted || (status !== 404 && status !== 403)) {
                    throw cause
                }
                console.warn(
                    `[profile-widget] file resource ${id} could not be resolved`,
                    cause
                )
                return undefined
            }
        })
    )
    return new Map(entries.filter((entry) => entry !== undefined))
}

const toBatches = (ids: readonly string[]) => {
    const batches: string[][] = []
    for (
        let index = 0;
        index < ids.length;
        index += ORGANISATION_UNIT_BATCH_SIZE
    ) {
        batches.push(ids.slice(index, index + ORGANISATION_UNIT_BATCH_SIZE))
    }
    return batches
}

const fetchOrganisationUnits = async (
    client: ProfileWidgetClient,
    organisationUnitIds: readonly string[],
    signal?: AbortSignal
): Promise<ReadonlyMap<string, OrganisationUnitLookup>> => {
    const responses = await Promise.all(
        toBatches(sortedUnique(organisationUnitIds)).map((batch) =>
            client.query(
                {
                    resource: 'organisationUnits',
                    params: {
                        fields: ORGANISATION_UNIT_LOOKUP_FIELDS,
                        filter: `id:in:[${batch.join(',')}]`,
                        paging: false,
                    },
                },
                OrganisationUnitsResponseSchema,
                signal
            )
        )
    )
    return new Map(
        responses.flatMap((response) =>
            response.organisationUnits.map(
                (organisationUnit) =>
                    [
                        organisationUnit.id,
                        {
                            name: organisationUnit.displayName,
                            path: organisationUnit.ancestors.map(
                                (ancestor) => ancestor.displayName
                            ),
                        },
                    ] as const
            )
        )
    )
}

export const fileResourceNamesQueryOptions = (
    client: ProfileWidgetClient,
    fileResourceIds: readonly string[]
) =>
    queryOptions({
        queryKey: profileWidgetQueryKeys.fileResourceNames(fileResourceIds),
        queryFn: ({ signal }) =>
            fetchFileResourceNames(client, fileResourceIds, signal),
        staleTime: LOOKUP_STALE_TIME,
        retry: shouldRetryProfileWidgetRequest,
    })

export const organisationUnitsQueryOptions = (
    client: ProfileWidgetClient,
    organisationUnitIds: readonly string[]
) =>
    queryOptions({
        queryKey: profileWidgetQueryKeys.organisationUnits(organisationUnitIds),
        queryFn: ({ signal }) =>
            fetchOrganisationUnits(client, organisationUnitIds, signal),
        staleTime: LOOKUP_STALE_TIME,
        retry: shouldRetryProfileWidgetRequest,
    })
