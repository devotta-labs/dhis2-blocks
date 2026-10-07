import type { FilterParsingContext } from '../registry/valueTypes'
import { asWorkingListBoundaryError } from './client'
import type { WorkingListClient } from './client'
import type { ProgramFieldCatalog } from './metadata'
import {
    ProgramStageWorkingListsResponseSchema,
    TrackedEntityInstanceFiltersResponseSchema,
} from './schemas'
import type { NormalizedSavedWorkingList } from './savedListContracts'
import { normalizeSavedWorkingListResource } from './savedListNormalization'

export const fetchSavedWorkingLists = async ({
    client,
    programId,
    metadata,
    parsingContext,
    signal,
}: {
    client: WorkingListClient
    programId: string
    metadata: ProgramFieldCatalog
    parsingContext?: FilterParsingContext
    signal?: AbortSignal
}): Promise<NormalizedSavedWorkingList[]> => {
    const commonParams = {
        filter: `program.id:eq:${programId}`,
        paging: false,
    }

    const [trackedEntityResponse, eventResponse] = await Promise.all([
        client.query(
            {
                resource: 'trackedEntityInstanceFilters',
                params: {
                    ...commonParams,
                    fields: 'id,displayName,sortOrder,program,entityQueryCriteria,access,externalAccess,publicAccess,user,userAccesses,userGroupAccesses',
                },
            },
            TrackedEntityInstanceFiltersResponseSchema,
            signal
        ),
        client.query(
            {
                resource: 'programStageWorkingLists',
                params: {
                    ...commonParams,
                    fields: 'id,displayName,sortOrder,program,programStage,programStageQueryCriteria,access,externalAccess,publicAccess,user,userAccesses,userGroupAccesses',
                },
            },
            ProgramStageWorkingListsResponseSchema,
            signal
        ),
    ])

    try {
        return [
            ...trackedEntityResponse.trackedEntityInstanceFilters.map(
                (resource) =>
                    normalizeSavedWorkingListResource({
                        resource,
                        type: 'trackedEntityInstanceFilters',
                        programId,
                        metadata,
                        parsingContext,
                    })
            ),
            ...eventResponse.programStageWorkingLists.map((resource) =>
                normalizeSavedWorkingListResource({
                    resource,
                    type: 'programStageWorkingLists',
                    programId,
                    metadata,
                    parsingContext,
                })
            ),
        ].sort(
            (left, right) =>
                (left.sortOrder ?? Number.MAX_SAFE_INTEGER) -
                    (right.sortOrder ?? Number.MAX_SAFE_INTEGER) ||
                left.name.localeCompare(right.name)
        )
    } catch (error) {
        throw asWorkingListBoundaryError(error, 'Malformed saved-list response')
    }
}
