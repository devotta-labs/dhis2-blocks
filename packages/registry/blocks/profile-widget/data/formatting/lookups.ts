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
    /** Ancestor names, root first. */
    path: readonly string[]
}

export interface LookupIds {
    /** FILE_RESOURCE values (IMAGE needs no name). Sorted, unique. */
    fileResourceIds: readonly string[]
    /** ORGANISATION_UNIT values. Sorted, unique. */
    organisationUnitIds: readonly string[]
}

/** Capture's batch size for `organisationUnits?filter=id:in:[…]` (orgUnitName.ts). */
export const ORGANISATION_UNIT_BATCH_SIZE = 50

/** Lookups change rarely; keep them for the session like Capture's module cache. */
const LOOKUP_STALE_TIME = 60 * 60_000

const sortedUnique = (ids: Iterable<string>) => [...new Set(ids)].sort()

/**
 * The ids a set of values needs resolved before it can be formatted. Values
 * with options never need a lookup: the option name wins, as in Capture.
 */
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

export const fetchFileResourceNames = async (
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
                // A file resource that is gone (404) or not visible (403)
                // blanks only its own row. Network, 5xx and boundary failures
                // reject, so the query retries and the formatter reports
                // 'Load file names' instead of caching a blank name.
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

/**
 * Batched org-unit names with their ancestor paths. An id the user cannot see
 * is simply missing from the map; the formatter then shows the raw id.
 */
export const fetchOrganisationUnits = async (
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

/**
 * `fileResources/{id}?fields=id,displayName` per id. A missing or inaccessible
 * file (403/404) blanks its name; other failures reject.
 */
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

/** Batched `organisationUnits?filter=id:in:[…]&fields=id,displayName,ancestors[displayName]`. */
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
