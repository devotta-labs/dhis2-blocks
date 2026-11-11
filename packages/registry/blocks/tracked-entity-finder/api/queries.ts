import type { useDataEngine } from '@dhis2/app-runtime'
import { queryOptions } from '@tanstack/react-query'
import { serializeFilter, toSearchParams } from '../rules/searchParams'
import type { ProgramModel, ValidatedSearch } from '../rules/types'
import { shouldRetryFinderRequest, toRequestError } from './requestErrors'
import {
    normaliseProgram,
    ProgramResponseSchema,
    TrackedEntitiesResponseSchema,
} from './schemas'
import {
    isTooManyConflict,
    toSearchOutcome,
    type SearchOutcome,
} from './search'

export type FinderEngine = Pick<ReturnType<typeof useDataEngine>, 'query'>
export interface FinderScope {
    server: string
    userId: string | undefined
}

export const METADATA_CACHE_TIME = 3 * 60 * 60_000
const SEARCH_CACHE_TIME = 5 * 60_000

export const finderKeys = {
    all: ['tracked-entity-finder'] as const,
    systemInfo: (scope: FinderScope) =>
        [...finderKeys.all, 'system-info', scope.server, scope.userId] as const,
    program: (scope: FinderScope, program: string) =>
        [
            ...finderKeys.all,
            'program',
            scope.server,
            scope.userId,
            program,
        ] as const,
    search: (
        scope: FinderScope,
        program: string,
        search: ValidatedSearch | undefined,
        page: number
    ) =>
        [
            ...finderKeys.all,
            'search',
            scope.server,
            scope.userId,
            program,
            search?.filters.map(serializeFilter).sort() ?? [],
            page,
        ] as const,
}

export const searchQueryOptions = (
    engine: FinderEngine,
    scope: FinderScope,
    model: ProgramModel,
    search: ValidatedSearch,
    page: number
) =>
    queryOptions({
        queryKey: finderKeys.search(scope, model.program, search, page),
        queryFn: async ({ signal }): Promise<SearchOutcome> => {
            try {
                const response = await engine.query(
                    {
                        trackedEntityFinderResource: {
                            resource: 'tracker/trackedEntities',
                            params: toSearchParams(model, search, page),
                        },
                    },
                    { signal }
                )
                return toSearchOutcome(
                    TrackedEntitiesResponseSchema.parse(
                        response.trackedEntityFinderResource
                    ),
                    model,
                    page
                )
            } catch (cause) {
                const error = toRequestError(cause)
                if (isTooManyConflict(error) && !signal.aborted) {
                    return { kind: 'too-many' }
                }
                throw error
            }
        },
        staleTime: SEARCH_CACHE_TIME,
        gcTime: SEARCH_CACHE_TIME,
        retry: shouldRetryFinderRequest,
    })

const ATTRIBUTE_FIELDS =
    'trackedEntityAttribute[id,displayName,displayFormName,valueType,unique,optionSet[id,options[code,displayName]],preferredSearchOperator,blockedSearchOperators,minCharactersToSearch]'

const PROGRAM_FIELDS = `displayName,minAttributesRequiredToSearch,maxTeiCountToReturn,trackedEntityType[id],programTrackedEntityAttributes[searchable,displayInList,sortOrder,preferredSearchOperator,blockedSearchOperators,minCharactersToSearch,${ATTRIBUTE_FIELDS}]`

export const programMetadataQueryOptions = (
    engine: FinderEngine,
    scope: FinderScope,
    program: string
) =>
    queryOptions({
        queryKey: finderKeys.program(scope, program),
        queryFn: async ({ signal }) => {
            try {
                const response = await engine.query(
                    {
                        trackedEntityFinderResource: {
                            resource: 'programs',
                            id: program,
                            params: { fields: PROGRAM_FIELDS },
                        },
                    },
                    { signal }
                )
                return normaliseProgram(
                    program,
                    ProgramResponseSchema.parse(
                        response.trackedEntityFinderResource
                    )
                )
            } catch (cause) {
                throw toRequestError(cause)
            }
        },
        staleTime: METADATA_CACHE_TIME,
        gcTime: METADATA_CACHE_TIME,
        retry: shouldRetryFinderRequest,
    })
