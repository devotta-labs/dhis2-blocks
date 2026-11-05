import { queryOptions } from '@tanstack/react-query'
import {
    cacheIdOf,
    shouldRetryFinderRequest,
    type FinderResourceClient,
} from './client'
import { normaliseProgram, ProgramResponseSchema } from './schemas'

interface SearchSubmission {
    instance: number
    submission: number
    filter: readonly string[]
}

export const finderKeys = {
    all: ['tracked-entity-finder'] as const,
    systemInfo: (client: FinderResourceClient) =>
        [...finderKeys.all, 'system-info', cacheIdOf(client)] as const,
    program: (client: FinderResourceClient, program: string) =>
        [...finderKeys.all, 'program', cacheIdOf(client), program] as const,
    search: (
        client: FinderResourceClient,
        program: string,
        submission: SearchSubmission,
        page: number
    ) =>
        [
            ...finderKeys.all,
            'search',
            { client: cacheIdOf(client), program, ...submission },
            page,
        ] as const,
}

export const isSameFinderSearch = (
    previous: ReturnType<typeof finderKeys.search> | undefined,
    current: ReturnType<typeof finderKeys.search>
): boolean => {
    const owner = previous?.[2]
    const next = current[2]
    return (
        owner !== undefined &&
        owner.client === next.client &&
        owner.program === next.program &&
        owner.instance === next.instance &&
        owner.submission === next.submission
    )
}

const ATTRIBUTE_FIELDS =
    'trackedEntityAttribute[id,displayName,displayFormName,valueType,unique,optionSet[id,options[code,displayName]],preferredSearchOperator,blockedSearchOperators,minCharactersToSearch]'

const PROGRAM_FIELDS = `displayName,minAttributesRequiredToSearch,maxTeiCountToReturn,trackedEntityType[id],programTrackedEntityAttributes[searchable,displayInList,sortOrder,preferredSearchOperator,blockedSearchOperators,minCharactersToSearch,${ATTRIBUTE_FIELDS}]`

export const programMetadataQueryOptions = (
    client: FinderResourceClient,
    program: string
) =>
    queryOptions({
        queryKey: finderKeys.program(client, program),
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
        staleTime: 60 * 60_000,
        retry: shouldRetryFinderRequest,
    })
