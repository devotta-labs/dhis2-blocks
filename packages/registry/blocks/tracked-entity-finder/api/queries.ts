import { queryOptions } from '@tanstack/react-query'
import {
    shouldRetryFinderRequest,
    type DataEngineQueryParameters,
    type FinderResourceClient,
} from './client'
import { normaliseProgram, ProgramResponseSchema } from './schemas'

export const finderKeys = {
    all: ['tracked-entity-finder'] as const,
    systemInfo: () => [...finderKeys.all, 'system-info'] as const,
    program: (program: string) =>
        [...finderKeys.all, 'program', program] as const,
    search: (
        program: string,
        submission: DataEngineQueryParameters,
        page: number
    ) => [...finderKeys.all, 'search', program, submission, page] as const,
}

const ATTRIBUTE_FIELDS =
    'trackedEntityAttribute[id,displayName,displayFormName,valueType,unique,optionSet[id,options[code,displayName]],preferredSearchOperator,blockedSearchOperators,minCharactersToSearch]'

const PROGRAM_FIELDS = `displayName,minAttributesRequiredToSearch,maxTeiCountToReturn,trackedEntityType[id],programTrackedEntityAttributes[searchable,displayInList,sortOrder,${ATTRIBUTE_FIELDS}]`

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
        staleTime: Number.POSITIVE_INFINITY,
        retry: shouldRetryFinderRequest,
    })
