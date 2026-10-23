import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { useContext, type ReactNode } from 'react'
import { render } from 'vitest-browser-react'
import {
    createTrackedEntityFinderClient,
    type DataEngineQuery,
    type DataEngineLike,
    type ResourceRequest,
    type TrackedEntityFinderClient,
} from '../api/client'
import type { ProgramMetadata } from '../api/schemas'
import { FinderContext } from '../provider/context'
import { serializeFilter } from '../rules/searchParams'
import { hivProgram } from './fixtures/program'

type EngineResult = Awaited<ReturnType<DataEngineLike['query']>>
type EngineValue = EngineResult[string]

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

export interface FakeServer {
    client: TrackedEntityFinderClient
    /** Every request the finder made, in order. */
    requests: ResourceRequest[]
}

export interface FakeServerOptions {
    program?: ProgramMetadata
    /** Never answers the program request, so the finder stays loading. */
    programPending?: boolean
    programFails?: boolean
    searchResponse?: EngineValue
}

/** A finder client over a fake engine serving `hivProgram` by default. */
export const createFakeServer = (
    options: FakeServerOptions = {}
): FakeServer => {
    const requests: ResourceRequest[] = []
    const program = options.program ?? hivProgram
    const engine: DataEngineLike = {
        query: async (query: DataEngineQuery) => {
            const [[key, request]] = Object.entries(query)
            requests.push(request)
            switch (request.resource) {
                case 'programs':
                    if (options.programPending) {
                        return new Promise<EngineResult>(() => {})
                    }
                    if (options.programFails) {
                        throw new Error('Program request failed')
                    }
                    return { [key]: toProgramResponse(program) }
                case 'system/info':
                    return {
                        [key]: {
                            calendar: 'gregorian',
                            dateFormat: 'YYYY-MM-DD',
                        },
                    }
                default:
                    return {
                        [key]: options.searchResponse ?? {
                            trackedEntities: [],
                            pager: { page: 1, pageSize: 10, total: 0 },
                        },
                    }
            }
        },
    }
    return { client: createTrackedEntityFinderClient(engine), requests }
}

/** Renders inside a fresh QueryClient with retries off. */
export const renderWithQueries = (ui: ReactNode) => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return render(
        <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
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
