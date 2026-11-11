import type { FilterParsingContext } from '../registry/valueTypes'
import { asWorkingListBoundaryError, type DataEngine } from './request'
import type { ProgramFieldCatalog } from './metadata'
import {
    ProgramStageWorkingListsResponseSchema,
    TrackedEntityInstanceFiltersResponseSchema,
} from './schemas'
import type { NormalizedSavedWorkingList } from './savedListContracts'
import { normalizeSavedWorkingListResource } from './savedListNormalization'

const SAVED_LIST_SHARING_FIELDS =
    'access,externalAccess,publicAccess,user,userAccesses,userGroupAccesses'

export const TRACKED_ENTITY_FILTER_FIELDS = `id,displayName,sortOrder,program,entityQueryCriteria,${SAVED_LIST_SHARING_FIELDS}`

export const PROGRAM_STAGE_WORKING_LIST_FIELDS = `id,displayName,sortOrder,program,programStage,programStageQueryCriteria,${SAVED_LIST_SHARING_FIELDS}`

export const fetchSavedWorkingLists = async ({
    engine,
    programId,
    metadata,
    parsingContext,
    signal,
}: {
    engine: DataEngine
    programId: string
    metadata: ProgramFieldCatalog
    parsingContext?: FilterParsingContext
    signal?: AbortSignal
}): Promise<NormalizedSavedWorkingList[]> => {
    const commonParams = {
        filter: `program.id:eq:${programId}`,
        paging: false,
    }
    const { trackedEntityLists, eventLists } = await engine.query(
        {
            trackedEntityLists: {
                resource: 'trackedEntityInstanceFilters',
                params: {
                    ...commonParams,
                    fields: TRACKED_ENTITY_FILTER_FIELDS,
                },
            },
            eventLists: {
                resource: 'programStageWorkingLists',
                params: {
                    ...commonParams,
                    fields: PROGRAM_STAGE_WORKING_LIST_FIELDS,
                },
            },
        },
        { signal }
    )
    const trackedEntityResponse =
        TrackedEntityInstanceFiltersResponseSchema.parse(trackedEntityLists)
    const eventResponse =
        ProgramStageWorkingListsResponseSchema.parse(eventLists)
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
