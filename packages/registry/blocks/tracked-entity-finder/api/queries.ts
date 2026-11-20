import type { useDataEngine } from '@dhis2/app-runtime'
import { queryOptions } from '@tanstack/react-query'
import { serializeFilter, toSearchParams } from '../rules/searchParams'
import type { FinderScope, ProgramModel, ValidatedSearch } from '../rules/types'
import { shouldRetryFinderRequest, toRequestError } from './requestErrors'
import {
    normaliseProgram,
    normaliseTrackedEntityType,
    ProgramResponseSchema,
    TrackedEntitiesResponseSchema,
    TrackedEntityTypeResponseSchema,
    type ProgramMetadata,
} from './schemas'
import {
    isTooManyConflict,
    toSearchOutcome,
    type SearchOutcome,
} from './search'

export type FinderEngine = Pick<ReturnType<typeof useDataEngine>, 'query'>

export const METADATA_CACHE_TIME = 3 * 60 * 60_000
const SEARCH_CACHE_TIME = 5 * 60_000

export const finderKeys = {
    all: ['tracked-entity-finder'] as const,
    systemInfo: (server: string) =>
        [...finderKeys.all, 'system-info', server] as const,
    metadata: (server: string, scope: FinderScope) =>
        [...finderKeys.all, scope.kind, server, scope.id] as const,
    search: (
        server: string,
        scope: FinderScope,
        search: ValidatedSearch | undefined,
        page: number
    ) =>
        [
            ...finderKeys.all,
            'search',
            server,
            scope.kind,
            scope.id,
            search?.filters.map(serializeFilter).sort() ?? [],
            page,
        ] as const,
}

/** The scope a model searches in. */
const scopeOf = (model: ProgramModel): FinderScope =>
    model.program
        ? { kind: 'program', id: model.program }
        : { kind: 'trackedEntityType', id: model.trackedEntityType }

export const searchQueryOptions = (
    engine: FinderEngine,
    server: string,
    model: ProgramModel,
    search: ValidatedSearch,
    page: number
) =>
    queryOptions({
        queryKey: finderKeys.search(server, scopeOf(model), search, page),
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

const TRACKED_ENTITY_TYPE_FIELDS = `displayName,minAttributesRequiredToSearch,maxTeiCountToReturn,trackedEntityTypeAttributes[searchable,displayInList,${ATTRIBUTE_FIELDS}]`

/** The search rules of a program, or of a tracked entity type without one. */
export const metadataQueryOptions = (
    engine: FinderEngine,
    server: string,
    scope: FinderScope
) =>
    queryOptions({
        queryKey: finderKeys.metadata(server, scope),
        queryFn: async ({ signal }): Promise<ProgramMetadata> => {
            const program = scope.kind === 'program'
            try {
                const response = await engine.query(
                    {
                        trackedEntityFinderResource: {
                            resource: program
                                ? 'programs'
                                : 'trackedEntityTypes',
                            id: scope.id,
                            params: {
                                fields: program
                                    ? PROGRAM_FIELDS
                                    : TRACKED_ENTITY_TYPE_FIELDS,
                            },
                        },
                    },
                    { signal }
                )
                const resource = response.trackedEntityFinderResource
                return program
                    ? normaliseProgram(
                          scope.id,
                          ProgramResponseSchema.parse(resource)
                      )
                    : normaliseTrackedEntityType(
                          scope.id,
                          TrackedEntityTypeResponseSchema.parse(resource)
                      )
            } catch (cause) {
                throw toRequestError(cause)
            }
        },
        staleTime: METADATA_CACHE_TIME,
        gcTime: METADATA_CACHE_TIME,
        retry: shouldRetryFinderRequest,
    })
