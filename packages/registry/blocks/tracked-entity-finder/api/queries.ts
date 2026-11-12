import { FetchError, useConfig, useDataEngine } from '@dhis2/app-runtime'
import {
    infiniteQueryOptions,
    skipToken,
    useInfiniteQuery,
    useQuery,
    useQueryClient,
} from '@tanstack/react-query'
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

/** Program rules and system info change rarely: reloaded after three hours. */
const METADATA_CACHE_TIME = 3 * 60 * 60_000

/** The same search is answered from the cache for five minutes. */
const SEARCH_CACHE_TIME = 5 * 60_000

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

/**
 * The program's search rules and attributes, kept for three hours, also
 * while no finder is mounted. Keys carry the server, so two servers behind
 * one QueryClient never share an answer.
 */
export const useProgramMetadata = (program: string) => {
    const engine = useDataEngine()
    const { baseUrl } = useConfig()
    return useQuery({
        queryKey: ['tracked-entity-finder', 'program', baseUrl, program],
        queryFn: ({ signal }) => fetchProgramMetadata(engine, program, signal),
        staleTime: METADATA_CACHE_TIME,
        gcTime: METADATA_CACHE_TIME,
        retry: shouldRetryRequest,
    })
}

/** The server's calendar, date format and version, kept for three hours. */
export const useSystemInfo = () => {
    const engine = useDataEngine()
    const { baseUrl } = useConfig()
    return useQuery({
        queryKey: ['tracked-entity-finder', 'system-info', baseUrl],
        queryFn: ({ signal }) => fetchSystemInfo(engine, signal),
        staleTime: METADATA_CACHE_TIME,
        gcTime: METADATA_CACHE_TIME,
        retry: shouldRetryRequest,
    })
}

/**
 * One search's pages. The key is what was searched for: the server, the
 * program and the filters in any order. Not when Search was pressed, so the
 * same search within five minutes, also after a remount, is answered from
 * the cache.
 */
const searchPagesOptions = (
    engine: DataEngine,
    baseUrl: string,
    model: ProgramModel | undefined,
    search: ValidatedSearch | undefined
) =>
    infiniteQueryOptions({
        queryKey: [
            'tracked-entity-finder',
            'search',
            baseUrl,
            model?.program,
            search?.filters.map(serializeFilter).sort(),
        ],
        queryFn:
            model && search
                ? ({ pageParam, signal }) =>
                      fetchSearchPage(engine, model, search, pageParam, signal)
                : skipToken,
        initialPageParam: 1,
        getNextPageParam: (last) =>
            last.kind === 'results' && last.hasNext ? last.page + 1 : undefined,
        staleTime: SEARCH_CACHE_TIME,
        gcTime: SEARCH_CACHE_TIME,
        retry: shouldRetryRequest,
    })

/**
 * The submitted search, loaded a page at a time; every page stays, so going
 * back sends nothing.
 */
export const useSearchPages = (
    model: ProgramModel | undefined,
    search: ValidatedSearch | undefined
) => {
    const engine = useDataEngine()
    const { baseUrl } = useConfig()
    return useInfiniteQuery(searchPagesOptions(engine, baseUrl, model, search))
}

/**
 * What pressing Search does. The results parts already load a search they
 * have not seen; pressing Search again for the same one does not change
 * their key, so this asks the server again when the answer is older than
 * five minutes or failed, from the first page. A fresh answer, or one still
 * on its way, is left alone.
 */
export const useRunSearch = () => {
    const engine = useDataEngine()
    const { baseUrl } = useConfig()
    const queryClient = useQueryClient()
    return (model: ProgramModel, search: ValidatedSearch) => {
        void queryClient.prefetchInfiniteQuery({
            ...searchPagesOptions(engine, baseUrl, model, search),
            pages: 1,
        })
    }
}
