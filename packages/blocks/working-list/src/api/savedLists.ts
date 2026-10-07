import type { FieldCatalog } from '../domain/model'
import { DEFAULT_WORKING_LIST_SORT } from '../query/serialize'
import type { WorkingListClient } from './client'
import {
    DeleteMutationResponseSchema,
    MutationResponseSchema,
    ProgramStageWorkingListSchema,
    TrackedEntityInstanceFilterSchema,
} from './schemas'
import type {
    NormalizedSavedWorkingList,
    SavedListResource,
} from './savedListContracts'
import { buildSavedListPayload } from './savedListPayload'

export type {
    NormalizedSavedWorkingList,
    SavedListResource,
} from './savedListContracts'

export { normalizeSavedWorkingListResource } from './savedListNormalization'

export { buildSavedListPayload } from './savedListPayload'

export { fetchSavedWorkingLists } from './savedListQueries'

export { repairSavedWorkingList } from './savedListRepair'

export const createSavedWorkingList = async ({
    client,
    ...input
}: Parameters<typeof buildSavedListPayload>[0] & {
    client: WorkingListClient
}) => {
    const payload = buildSavedListPayload(input)

    const response = await client.mutate(
        { resource: payload.resource, type: 'create', data: payload.data },
        MutationResponseSchema
    )

    const id = response.response?.uid

    if (!id) {
        throw new Error('Create saved-list response did not contain a UID')
    }

    return id
}

export const replaceSavedWorkingList = async ({
    client,
    id,
    resource,
    existingResource,
    ...input
}: Parameters<typeof buildSavedListPayload>[0] & {
    client: WorkingListClient
    id: string
    resource: SavedListResource
}) => {
    const expectedResource =
        input.configuration.mode === 'trackedEntity'
            ? 'trackedEntityInstanceFilters'
            : 'programStageWorkingLists'

    if (expectedResource !== resource) {
        throw new Error(
            `Cannot replace ${resource} with ${expectedResource} configuration`
        )
    }

    const currentResource =
        existingResource ??
        (await client.query(
            {
                resource,
                id,
                params: {
                    fields:
                        resource === 'trackedEntityInstanceFilters'
                            ? 'id,displayName,sortOrder,program,entityQueryCriteria,access,externalAccess,publicAccess,user,userAccesses,userGroupAccesses'
                            : 'id,displayName,sortOrder,program,programStage,programStageQueryCriteria,access,externalAccess,publicAccess,user,userAccesses,userGroupAccesses',
                },
            },
            resource === 'trackedEntityInstanceFilters'
                ? TrackedEntityInstanceFilterSchema
                : ProgramStageWorkingListSchema
        ))

    if (currentResource.id !== id) {
        throw new Error(
            `Loaded saved-list ${currentResource.id} while replacing ${id}`
        )
    }

    const payload = buildSavedListPayload({
        ...input,
        existingResource: currentResource,
    })

    if (payload.resource !== resource) {
        throw new Error(
            `Cannot replace ${resource} with ${payload.resource} configuration`
        )
    }

    await client.mutate(
        {
            resource,
            id,
            type: 'replace',
            data: payload.data,
        },
        MutationResponseSchema
    )
}

export const deleteSavedWorkingList = async (
    client: WorkingListClient,
    resource: SavedListResource,
    id: string
) =>
    client.mutate(
        { resource, id, type: 'delete' },
        DeleteMutationResponseSchema
    )

export const getSharingType = (resource: SavedListResource) =>
    resource === 'trackedEntityInstanceFilters'
        ? 'trackedEntityInstanceFilter'
        : 'programStageWorkingList'

/**
 * Capture parity: the unfiltered fallback view is a client-side template
 * whose id concatenates the program id with `-default`. Because the id is
 * written to the URL like any saved list, deselecting a list survives a
 * page reload instead of snapping back to the first available list.
 */
export const defaultWorkingListId = (programId: string) =>
    `${programId}-default`

export const createDefaultWorkingList = ({
    programId,
    columns,
}: {
    programId: string
    columns: string[]
}): Extract<NormalizedSavedWorkingList, { compatibility: 'compatible' }> => ({
    id: defaultWorkingListId(programId),
    name: 'default',
    resource: 'trackedEntityInstanceFilters',
    sharing: {},
    compatibility: 'compatible',
    configuration: {
        mode: 'trackedEntity',
        programId,
        filters: [],
        columns,
        sort: { ...DEFAULT_WORKING_LIST_SORT },
    },
})

export const createGeneratedDefaultLists = ({
    programId,
    columns,
    fields,
}: {
    programId: string
    columns: string[]
    fields: FieldCatalog
}): NormalizedSavedWorkingList[] => {
    const statusField = fields.get('enrollmentStatus')

    if (!statusField) {
        return []
    }

    return [
        [
            'active',
            'Active enrollments',
            'workingList.defaults.active',
            'ACTIVE',
        ],
        [
            'completed',
            'Completed enrollments',
            'workingList.defaults.completed',
            'COMPLETED',
        ],
        [
            'cancelled',
            'Cancelled enrollments',
            'workingList.defaults.cancelled',
            'CANCELLED',
        ],
    ].map(([id, name, labelKey, status], sortOrder) => ({
        id,
        name,
        labelKey,
        resource: 'trackedEntityInstanceFilters' as const,
        sortOrder,
        sharing: {},
        compatibility: 'compatible' as const,
        configuration: {
            mode: 'trackedEntity' as const,
            programId,
            filters: [
                {
                    field: statusField,
                    operator: 'in' as const,
                    value: { kind: 'options' as const, values: [status] },
                },
            ],
            columns,
            sort: { ...DEFAULT_WORKING_LIST_SORT },
        },
    }))
}
