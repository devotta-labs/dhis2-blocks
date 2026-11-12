import { CustomDataProvider, FetchError, Provider } from '@dhis2/app-runtime'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { useContext, type ComponentProps, type ReactNode } from 'react'
import { render } from 'vitest-browser-react'
import { z } from 'zod'
import type { ProgramMetadata } from '../api/schemas'
import { FinderContext } from '../provider/context'
import { FinderProvider } from '../provider/FinderProvider'
import { serializeFilter } from '../rules/searchParams'
import { hivProgram } from './fixtures/program'

type CustomData = ComponentProps<typeof CustomDataProvider>['data']

/** A request as the data engine hands it to the server. */
const RequestSchema = z.object({
    resource: z.string(),
    id: z.string().optional(),
    params: z.record(z.string(), z.json()).optional(),
})
type FinderRequest = z.infer<typeof RequestSchema>

const BodySchema = z.json()
type Body = z.infer<typeof BodySchema>

/** A failed request as app-runtime throws it; a 400 is never retried. */
export const requestFailure = (message: string, httpStatusCode = 400) =>
    new FetchError({
        type: 'unknown',
        message,
        details: { httpStatusCode, message },
    })

const never = () => new Promise<never>(() => {})

/** The raw `GET programs/<uid>` response the fixture was normalised from. */
const toProgramResponse = (program: ProgramMetadata) => ({
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

/** A search the fake server holds open until the test answers it. */
interface PendingSearch {
    request: FinderRequest
    respond: (response: Body) => void
}

export interface FakeServer {
    /** The server's URL, which keeps one server's cache from another's. */
    baseUrl: string
    /** The DHIS2 resources the finder asks for, for `CustomDataProvider`. */
    data: CustomData
    /** Every request the finder made, in order. */
    requests: FinderRequest[]
    /** With `deferSearches`, every search request, in order, still open or not. */
    pendingSearches: PendingSearch[]
}

export interface FakeServerOptions {
    baseUrl?: string
    /** Called on every request, e.g. to show a request log. */
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
    searchResponse?: Body
    /** Answers each search from its request, e.g. by page. */
    answerSearch?: (request: FinderRequest) => Body
    /** Answers searches with a 400, which is never retried. */
    searchFails?: boolean
    /** Holds every search open until the test calls `respond`. */
    deferSearches?: boolean
}

const EMPTY_SEARCH: Body = {
    trackedEntities: [],
    pager: { page: 1, pageSize: 10, total: 0 },
}

/** A fake DHIS2 behind app-runtime's data engine, serving `hivProgram` by default. */
export const createFakeServer = (
    options: FakeServerOptions = {}
): FakeServer => {
    const requests: FinderRequest[] = []
    const pendingSearches: PendingSearch[] = []
    const program = options.program ?? hivProgram
    const record = (request: FinderRequest) => {
        requests.push(request)
        options.onRequest?.()
        return request
    }
    const data: CustomData = {
        programs: async (_type, query) => {
            record(RequestSchema.parse(query))
            if (options.programPending) {
                return never()
            }
            if (options.programFails) {
                throw requestFailure('Program request failed')
            }
            return BodySchema.parse(toProgramResponse(program))
        },
        'system/info': async (_type, query) => {
            record(RequestSchema.parse(query))
            if (options.systemInfoPending) {
                return never()
            }
            if (options.systemInfoFails) {
                throw requestFailure('System info request failed')
            }
            return {
                calendar: 'gregorian',
                dateFormat: 'YYYY-MM-DD',
                version: options.version ?? '2.43.1',
            }
        },
        'tracker/trackedEntities': async (_type, query) => {
            const request = record(RequestSchema.parse(query))
            if (options.searchFails) {
                throw requestFailure('Search failed')
            }
            if (options.deferSearches) {
                return new Promise<Body>((respond) => {
                    pendingSearches.push({ request, respond })
                })
            }
            return (
                options.answerSearch?.(request) ??
                options.searchResponse ??
                EMPTY_SEARCH
            )
        },
    }
    return {
        baseUrl: options.baseUrl ?? 'https://dhis2.test',
        data,
        requests,
        pendingSearches,
    }
}

/** App-runtime as a host sets it up, with the fake server behind it. */
export const FakeServerProvider = ({
    server,
    children,
}: {
    server: FakeServer
    children: ReactNode
}) => (
    <Provider
        config={{ baseUrl: server.baseUrl, apiVersion: 43 }}
        userInfo={undefined}
        plugin={false}
        parentAlertsAdd={undefined}
        showAlertsInPlugin={false}
    >
        <CustomDataProvider data={server.data}>{children}</CustomDataProvider>
    </Provider>
)

/**
 * Renders inside app-runtime's providers, with the fake server behind them,
 * and a fresh QueryClient that retries without the wait between tries.
 */
export const renderWithQueries = (
    ui: ReactNode,
    server: FakeServer = createFakeServer()
) => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retryDelay: 0 } },
    })
    // A wrapper, so `rerender` keeps the same server and QueryClient.
    return render(ui, {
        wrapper: ({ children }) => (
            <QueryClientProvider client={queryClient}>
                <FakeServerProvider server={server}>
                    {children}
                </FakeServerProvider>
            </QueryClientProvider>
        ),
    })
}

/** Renders `children` under a `hivProgram` provider, with a SubmissionProbe. */
export const renderInFinder = (children: ReactNode) =>
    renderWithQueries(
        <FinderProvider program="hivProgram" onSelect={() => undefined}>
            {children}
            <SubmissionProbe />
        </FinderProvider>
    )

/**
 * Test-only: shows the last submitted search as serialised filters, one per
 * line, so tests can read exactly what Search would send.
 */
export const SubmissionProbe = () => {
    const context = useContext(FinderContext)
    const submission = context?.submission
    return (
        <output data-testid="submission">
            {submission
                ? submission.search.filters.map(serializeFilter).join('\n')
                : 'none'}
        </output>
    )
}
