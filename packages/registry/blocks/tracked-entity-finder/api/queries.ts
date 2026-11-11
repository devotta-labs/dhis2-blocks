import { FetchError, useDataEngine } from '@dhis2/app-runtime'
import { skipToken, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import type { FinderSubmission } from '../provider/context'
import { serializeFilter, toSearchParams } from '../rules/searchParams'
import type { ProgramModel, ValidatedSearch } from '../rules/types'
import {
    normaliseProgram,
    ProgramResponseSchema,
    TrackedEntitiesResponseSchema,
    type ProgramMetadata,
} from './schemas'
import {
    isTooManyConflict,
    toSearchOutcome,
    type SearchOutcome,
} from './search'
import { FinderSystemInfoSchema, type FinderServerInfo } from './systemInfo'

type DataEngine = ReturnType<typeof useDataEngine>

const ATTRIBUTE_FIELDS =
    'trackedEntityAttribute[id,displayName,displayFormName,valueType,unique,optionSet[id,options[code,displayName]],preferredSearchOperator,blockedSearchOperators,minCharactersToSearch]'

const PROGRAM_FIELDS = `displayName,minAttributesRequiredToSearch,maxTeiCountToReturn,trackedEntityType[id],programTrackedEntityAttributes[searchable,displayInList,sortOrder,preferredSearchOperator,blockedSearchOperators,minCharactersToSearch,${ATTRIBUTE_FIELDS}]`

/**
 * Only a failed request is retried, twice, and only when the server or the
 * network failed. A malformed response and a client error would fail the
 * same way again.
 */
export const shouldRetryRequest = (failureCount: number, error: Error) =>
    failureCount < 2 &&
    error instanceof FetchError &&
    error.type !== 'access' &&
    (error.details.httpStatusCode === undefined ||
        error.details.httpStatusCode >= 500)

const fetchProgramMetadata = async (
    engine: DataEngine,
    program: string,
    signal: AbortSignal
): Promise<ProgramMetadata> => {
    const { metadata } = await engine.query(
        {
            metadata: {
                resource: 'programs',
                id: program,
                params: { fields: PROGRAM_FIELDS },
            },
        },
        { signal }
    )
    return normaliseProgram(program, ProgramResponseSchema.parse(metadata))
}

const fetchSystemInfo = async (
    engine: DataEngine,
    signal: AbortSignal
): Promise<FinderServerInfo> => {
    const { systemInfo } = await engine.query(
        {
            systemInfo: {
                resource: 'system/info',
                params: { fields: 'calendar,dateFormat,version' },
            },
        },
        { signal }
    )
    return FinderSystemInfoSchema.parse(systemInfo)
}

/** A failed request throws; going over the result cap is an answer. */
const fetchSearchPage = async (
    engine: DataEngine,
    model: ProgramModel,
    search: ValidatedSearch,
    page: number,
    signal: AbortSignal
): Promise<SearchOutcome> => {
    try {
        const { trackedEntities } = await engine.query(
            {
                trackedEntities: {
                    resource: 'tracker/trackedEntities',
                    params: toSearchParams(model, search, page),
                },
            },
            { signal }
        )
        return toSearchOutcome(
            model,
            TrackedEntitiesResponseSchema.parse(trackedEntities),
            page
        )
    } catch (error) {
        if (error instanceof FetchError && isTooManyConflict(error)) {
            return { kind: 'too-many' }
        }
        throw error
    }
}

/** The program's search rules and attributes, reloaded after an hour. */
export const useProgramMetadata = (program: string) => {
    const engine = useDataEngine()
    return useQuery({
        queryKey: ['tracked-entity-finder', 'program', program],
        queryFn: ({ signal }) => fetchProgramMetadata(engine, program, signal),
        staleTime: 60 * 60_000,
        retry: shouldRetryRequest,
    })
}

/** The server's calendar, date format and version, which do not change. */
export const useSystemInfo = () => {
    const engine = useDataEngine()
    return useQuery({
        queryKey: ['tracked-entity-finder', 'system-info'],
        queryFn: ({ signal }) => fetchSystemInfo(engine, signal),
        staleTime: Number.POSITIVE_INFINITY,
        gcTime: Number.POSITIVE_INFINITY,
        retry: shouldRetryRequest,
    })
}

/**
 * The submitted search, loaded a page at a time; every page stays, so going
 * back sends nothing. The key carries when Search was pressed: pressing it
 * again, or after a remount, asks the server again, as someone may have been
 * registered since.
 */
export const useSearchPages = (
    model: ProgramModel | undefined,
    submission: FinderSubmission | undefined
) => {
    const engine = useDataEngine()
    return useInfiniteQuery({
        queryKey: [
            'tracked-entity-finder',
            'search',
            model?.program,
            submission?.search.filters.map(serializeFilter),
            submission?.submittedAt,
        ],
        queryFn:
            model && submission
                ? ({ pageParam, signal }) =>
                      fetchSearchPage(
                          engine,
                          model,
                          submission.search,
                          pageParam,
                          signal
                      )
                : skipToken,
        initialPageParam: 1,
        getNextPageParam: (last) =>
            last.kind === 'results' && last.hasNext ? last.page + 1 : undefined,
        // A submitted search never changes; Search again makes a new one.
        staleTime: Number.POSITIVE_INFINITY,
        retry: shouldRetryRequest,
    })
}
