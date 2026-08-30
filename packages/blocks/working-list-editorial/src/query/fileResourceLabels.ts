import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'
import {
    shouldRetryWorkingListRequest,
    type WorkingListClient,
} from '../api/client'
import type { FieldCatalog } from '../domain/model'
import { isWorkingListFileValue } from '../registry/valueTypes'
import type { WorkingListPage } from './fetchers'
import { workingListQueryKeys } from './keys'
import type { WorkingListRowValues } from './normalizeRows'

const FileResourceSchema = z
    .object({
        id: z.string().min(1),
        displayName: z.string().min(1),
    })
    .passthrough()

/**
 * Only FILE_RESOURCE cells need display names; IMAGE cells render previews
 * without a name, mirroring the Capture app's subvalue handling.
 */
const collectValueFileResources = (
    result: Set<string>,
    values: WorkingListRowValues,
    fields: FieldCatalog
) => {
    for (const [fieldId, cell] of Object.entries(values)) {
        if (
            fields.get(fieldId)?.valueType === 'FILE_RESOURCE' &&
            cell.valid &&
            isWorkingListFileValue(cell.value)
        ) {
            result.add(cell.value.id)
        }
    }
}

export const collectFileResourceIds = (
    page: WorkingListPage,
    fields: FieldCatalog
): string[] => {
    const result = new Set<string>()
    if (page.mode === 'trackedEntity') {
        page.records.forEach((record) =>
            collectValueFileResources(result, record.values, fields)
        )
    } else {
        page.records.forEach(({ event, trackedEntity }) => {
            collectValueFileResources(result, event.values, fields)
            if (trackedEntity) {
                collectValueFileResources(result, trackedEntity.values, fields)
            }
        })
    }
    return [...result].sort()
}

export const fetchFileResourceNames = async ({
    client,
    ids,
    signal,
}: {
    client: WorkingListClient
    ids: string[]
    signal?: AbortSignal
}): Promise<ReadonlyMap<string, string>> => {
    const uniqueIds = [...new Set(ids)].sort()
    const entries = await Promise.all(
        uniqueIds.map(async (id) => {
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
                return [resource.id, resource.displayName] as const
            } catch (error) {
                if (signal?.aborted) {
                    throw error
                }
                // Capture parity: a missing file resource blanks its cell
                // instead of failing the page.
                console.warn(
                    `[working-list] file resource ${id} could not be resolved`,
                    error
                )
                return undefined
            }
        })
    )
    return new Map(entries.filter((entry) => entry !== undefined))
}

export const fileResourceNamesQueryOptions = (
    client: WorkingListClient,
    ids: string[]
) =>
    queryOptions({
        queryKey: workingListQueryKeys.fileResourceNames(ids),
        queryFn: ({ signal }) =>
            fetchFileResourceNames({ client, ids, signal }),
        staleTime: 60 * 60_000,
        gcTime: 4 * 60 * 60_000,
        retry: shouldRetryWorkingListRequest,
    })

export const createFileResourceNameResolver =
    (names: ReadonlyMap<string, string>) => (id: string) =>
        names.get(id)
