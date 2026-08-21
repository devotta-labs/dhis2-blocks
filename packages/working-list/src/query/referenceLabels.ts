import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'
import {
    shouldRetryWorkingListRequest,
    type WorkingListClient,
} from '../api/client'
import type { FieldCatalog } from '../domain/model'
import type { WorkingListPage } from './fetchers'
import { workingListQueryKeys } from './keys'
import type {
    NormalizedTrackedEntity,
    WorkingListRowValues,
} from './normalizeRows'

export const OrganisationUnitLabelSchema = z
    .object({
        id: z.string().min(1),
        displayName: z.string().min(1),
        path: z.string().min(1).optional(),
    })
    .passthrough()

const OrganisationUnitLabelsResponseSchema = z
    .object({ organisationUnits: z.array(OrganisationUnitLabelSchema) })
    .passthrough()

export type OrganisationUnitLabel = z.infer<typeof OrganisationUnitLabelSchema>

/** Invalid cells never feed downstream requests, so only valid values count. */
const collectValueOrganisationUnits = (
    result: Set<string>,
    values: WorkingListRowValues,
    fields: FieldCatalog
) => {
    for (const [fieldId, cell] of Object.entries(values)) {
        const organisationUnitId = cell.valid
            ? z.string().min(1).safeParse(cell.value)
            : null
        if (
            fields.get(fieldId)?.valueType === 'ORGANISATION_UNIT' &&
            organisationUnitId?.success
        ) {
            result.add(organisationUnitId.data)
        }
    }
}

const collectTrackedEntityOrganisationUnits = (
    result: Set<string>,
    record: NormalizedTrackedEntity,
    fields: FieldCatalog
) => {
    record.trackedEntity.programOwners.forEach((owner) =>
        result.add(owner.orgUnit)
    )
    collectValueOrganisationUnits(result, record.values, fields)
}

export const collectOrganisationUnitIds = (
    page: WorkingListPage,
    fields: FieldCatalog
): string[] => {
    const result = new Set<string>()
    if (page.mode === 'trackedEntity') {
        page.records.forEach((record) =>
            collectTrackedEntityOrganisationUnits(result, record, fields)
        )
    } else {
        page.records.forEach(({ event, trackedEntity }) => {
            result.add(event.event.orgUnit)
            collectValueOrganisationUnits(result, event.values, fields)
            if (trackedEntity) {
                collectTrackedEntityOrganisationUnits(
                    result,
                    trackedEntity,
                    fields
                )
            }
        })
    }
    return [...result].sort()
}

export const fetchOrganisationUnitLabels = async ({
    client,
    ids,
    signal,
}: {
    client: WorkingListClient
    ids: string[]
    signal?: AbortSignal
}): Promise<ReadonlyMap<string, OrganisationUnitLabel>> => {
    const uniqueIds = [...new Set(ids)].sort()
    if (!uniqueIds.length) {
        return new Map()
    }
    const response = await client.query(
        {
            resource: 'organisationUnits',
            params: {
                fields: 'id,displayName,path',
                filter: `id:in:[${uniqueIds.join(',')}]`,
                paging: false,
            },
        },
        OrganisationUnitLabelsResponseSchema,
        signal
    )
    return new Map(
        response.organisationUnits.map((organisationUnit) => [
            organisationUnit.id,
            organisationUnit,
        ])
    )
}

export const organisationUnitLabelsQueryOptions = (
    client: WorkingListClient,
    ids: string[]
) =>
    queryOptions({
        queryKey: workingListQueryKeys.organisationUnitLabels(ids),
        queryFn: ({ signal }) =>
            fetchOrganisationUnitLabels({ client, ids, signal }),
        staleTime: 60 * 60_000,
        gcTime: 4 * 60 * 60_000,
        retry: shouldRetryWorkingListRequest,
    })

export const createOrganisationUnitLabelResolver =
    (labels: ReadonlyMap<string, OrganisationUnitLabel>) => (id: string) =>
        labels.get(id)?.displayName
