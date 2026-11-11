import { queryOptions } from '@tanstack/react-query'
import { serializeFilter } from '../rules/searchParams'
import type { ProgramModel, ValidatedSearch } from '../rules/types'
import { shouldRetryFinderRequest, type FinderResourceClient } from './client'
import { normaliseProgram, ProgramResponseSchema } from './schemas'
import { runSearch } from './search'

export const METADATA_CACHE_TIME = 3 * 60 * 60_000
const SEARCH_CACHE_TIME = 5 * 60_000

export const finderKeys = {
    all: ['tracked-entity-finder'] as const,
    systemInfo: () => [...finderKeys.all, 'system-info'] as const,
    program: (program: string) =>
        [...finderKeys.all, 'program', program] as const,
    search: (
        program: string,
        search: ValidatedSearch | undefined,
        page: number
    ) =>
        [
            ...finderKeys.all,
            'search',
            program,
            search?.filters.map(serializeFilter).sort() ?? [],
            page,
        ] as const,
}

export const searchQueryOptions = (
    client: FinderResourceClient,
    model: ProgramModel,
    search: ValidatedSearch,
    page: number
) =>
    queryOptions({
        queryKey: finderKeys.search(model.program, search, page),
        queryFn: ({ signal }) => runSearch(client, model, search, page, signal),
        staleTime: SEARCH_CACHE_TIME,
        gcTime: SEARCH_CACHE_TIME,
        retry: shouldRetryFinderRequest,
    })

const ATTRIBUTE_FIELDS =
    'trackedEntityAttribute[id,displayName,displayFormName,valueType,unique,optionSet[id,options[code,displayName]],preferredSearchOperator,blockedSearchOperators,minCharactersToSearch]'

const PROGRAM_FIELDS = `displayName,minAttributesRequiredToSearch,maxTeiCountToReturn,trackedEntityType[id],programTrackedEntityAttributes[searchable,displayInList,sortOrder,preferredSearchOperator,blockedSearchOperators,minCharactersToSearch,${ATTRIBUTE_FIELDS}]`

export const programMetadataQueryOptions = (
    client: FinderResourceClient,
    program: string
) =>
    queryOptions({
        queryKey: finderKeys.program(program),
        queryFn: ({ signal }) =>
            client
                .query(
                    {
                        resource: 'programs',
                        id: program,
                        params: { fields: PROGRAM_FIELDS },
                    },
                    ProgramResponseSchema,
                    signal
                )
                .then((response) => normaliseProgram(program, response)),
        staleTime: METADATA_CACHE_TIME,
        gcTime: METADATA_CACHE_TIME,
        retry: shouldRetryFinderRequest,
    })
