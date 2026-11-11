import {
    CustomDataProvider,
    Provider,
    type useDataEngine,
} from '@dhis2/app-runtime'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { useContext, type ReactNode, type ComponentProps } from 'react'
import { render } from 'vitest-browser-react'
import type { ProgramMetadata } from '../api/schemas'
import { FinderContext } from '../provider/context'
import {
    FinderProvider,
    type FinderProviderProps,
} from '../provider/FinderProvider'
import { serializeFilter } from '../rules/searchParams'
import { hivProgram } from './fixtures/program'

type EngineValue = Awaited<
    ReturnType<ReturnType<typeof useDataEngine>['mutate']>
>
type CustomResourceFactory = Exclude<
    ComponentProps<typeof CustomDataProvider>['data'][string],
    EngineValue
>
type ResourceRequest = Parameters<CustomResourceFactory>[1]

/** The raw `GET programs/<uid>` response the fixture was normalised from. */
const toProgramResponse = (program: ProgramMetadata): EngineValue => ({
    displayName: program.name,
    minAttributesRequiredToSearch: program.minAttributesRequiredToSearch,
    maxTeiCountToReturn: program.maxTeiCountToReturn,
    trackedEntityType: { id: program.trackedEntityType },
    programTrackedEntityAttributes: program.attributes.map(
        (attribute, sortOrder) => ({
            searchable: attribute.searchable,
            displayInList: attribute.displayInList,
            sortOrder,
            trackedEntityAttribute: {
                id: attribute.id,
                displayName: attribute.label,
                valueType: attribute.valueType,
                unique: attribute.unique,
                optionSet: attribute.options
                    ? {
                          options: attribute.options.map(({ code, name }) => ({
                              code,
                              displayName: name,
                          })),
                      }
                    : null,
                blockedSearchOperators: attribute.blockedSearchOperators,
                minCharactersToSearch: attribute.minCharactersToSearch,
            },
        })
    ),
})

/** A search the fake engine holds open until the test answers it. */
interface PendingSearch {
    request: ResourceRequest
    respond: (response: EngineValue) => void
}

export interface FakeServer {
    baseUrl: string
    data: ComponentProps<typeof CustomDataProvider>['data']
    /** Every request the finder made, in order. */
    requests: ResourceRequest[]
    /** With `deferSearches`, every search request, in order, still open or not. */
    pendingSearches: PendingSearch[]
}

export interface FakeServerOptions {
    baseUrl?: string
    onRequest?: () => void
    program?: ProgramMetadata
    /** Never answers the program request, so the finder stays loading. */
    programPending?: boolean
    programFails?: boolean
    /** Never answers the system info request. */
    systemInfoPending?: boolean
    systemInfoFails?: boolean
    /** The DHIS2 version system info reports; 2.43.1 by default. */
    version?: string
    searchResponse?: EngineValue
    /** Answers each search from its request, e.g. by page. */
    answerSearch?: (request: ResourceRequest) => EngineValue
    /** Answers searches with a 400, which is never retried. */
    searchFails?: boolean
    /** Holds every search open until the test calls `respond`. */
    deferSearches?: boolean
}

const EMPTY_SEARCH: EngineValue = {
    trackedEntities: [],
    pager: { page: 1, pageSize: 10, total: 0 },
}

/** Fake app-runtime resources serving `hivProgram` by default. */
export const createFakeServer = (
    options: FakeServerOptions = {}
): FakeServer => {
    const requests: ResourceRequest[] = []
    const pendingSearches: PendingSearch[] = []
    const program = options.program ?? hivProgram
    const respond: CustomResourceFactory = async (_type, request) => {
        requests.push(request)
        options.onRequest?.()
        switch (request.resource) {
            case 'programs':
                if (options.programPending)
                    return new Promise<EngineValue>(() => {})
                if (options.programFails)
                    throw new Error('Program request failed')
                return toProgramResponse(program)
            case 'system/info':
                if (options.systemInfoPending)
                    return new Promise<EngineValue>(() => {})
                if (options.systemInfoFails)
                    throw new Error('System info request failed')
                return {
                    calendar: 'gregorian',
                    dateFormat: 'YYYY-MM-DD',
                    version: options.version ?? '2.43.1',
                }
            default:
                if (options.searchFails) {
                    throw Object.assign(new Error('Search failed'), {
                        httpStatusCode: 400,
                    })
                }
                if (options.deferSearches) {
                    return new Promise<EngineValue>((resolve) => {
                        pendingSearches.push({ request, respond: resolve })
                    })
                }
                return (
                    options.answerSearch?.(request) ??
                    options.searchResponse ??
                    EMPTY_SEARCH
                )
        }
    }

    return {
        baseUrl: options.baseUrl ?? 'https://dhis2.test',
        data: {
            programs: respond,
            'system/info': respond,
            'tracker/trackedEntities': respond,
        },
        requests,
        pendingSearches,
    }
}

export const FinderTestProvider = ({
    server,
    ...props
}: FinderProviderProps & { server: FakeServer }) => (
    <Provider
        config={{ baseUrl: server.baseUrl, apiVersion: 43 }}
        userInfo={undefined}
        plugin={false}
        parentAlertsAdd={undefined}
        showAlertsInPlugin={false}
    >
        <CustomDataProvider data={server.data}>
            <FinderProvider {...props} />
        </CustomDataProvider>
    </Provider>
)

/** Renders inside a fresh QueryClient with retries off by default. */
export const renderWithQueries = (ui: ReactNode) => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    // A wrapper, so `rerender` keeps the same QueryClient.
    return render(ui, {
        wrapper: ({ children }) => (
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        ),
    })
}

/** Renders `children` under a `hivProgram` provider, with a SubmissionProbe. */
export const renderInFinder = (children: ReactNode) => {
    const server = createFakeServer()
    return renderWithQueries(
        <FinderTestProvider
            program="hivProgram"
            server={server}
            onSelect={() => undefined}
        >
            {children}
            <SubmissionProbe />
        </FinderTestProvider>
    )
}

/**
 * Test-only: shows the last submitted search as serialised filters, one per
 * line, so tests can read exactly what Search would send.
 */
export const SubmissionProbe = () => {
    const context = useContext(FinderContext)
    const submission = context?.state.submission
    return (
        <output data-testid="submission">
            {submission
                ? submission.search.filters.map(serializeFilter).join('\n')
                : 'none'}
        </output>
    )
}
