import { QueryClient } from '@tanstack/react-query'
import {
    cacheIdOf,
    createFinderResourceClient,
    type DataEngineQuery,
} from './client'
import { finderKeys, programMetadataQueryOptions } from './queries'
import { systemInfoQueryOptions } from './systemInfo'

describe('program metadata query', () => {
    it('requests the program fields the rules need', async () => {
        const query = vi.fn(async (_query: DataEngineQuery) => ({
            trackedEntityFinderResource: {
                displayName: 'HIV',
                trackedEntityType: { id: 'tet' },
                programTrackedEntityAttributes: [],
            },
        }))
        const client = createFinderResourceClient({ query })
        const options = programMetadataQueryOptions(client, 'prog')
        await new QueryClient().fetchQuery(options)

        const sent = query.mock.calls[0]?.[0]
        const request = sent?.trackedEntityFinderResource
        expect(request).toMatchObject({ resource: 'programs', id: 'prog' })
        const { fields } = request?.params ?? { fields: '' }
        expect(fields).toContain('minAttributesRequiredToSearch')
        expect(fields).toContain('maxTeiCountToReturn')
        expect(fields).toContain(
            'programTrackedEntityAttributes[searchable,displayInList,sortOrder,preferredSearchOperator,blockedSearchOperators,minCharactersToSearch,'
        )
        expect(fields).toContain('blockedSearchOperators')
        expect(options.queryKey).toEqual(finderKeys.program(client, 'prog'))
    })

    it('keys searches by program, submission and page', () => {
        const client = createFinderResourceClient({ query: vi.fn() })
        const submission = { instance: 1, submission: 2, filter: ['a:eq:b'] }
        expect(finderKeys.search(client, 'p', submission, 2)).toEqual([
            'tracked-entity-finder',
            'search',
            { client: cacheIdOf(client), program: 'p', ...submission },
            2,
        ])
    })

    it('isolates metadata and calendars by source while reusing each source', async () => {
        const source = (name: string, calendar: string) => {
            const query = vi.fn(async (request: DataEngineQuery) => ({
                trackedEntityFinderResource:
                    request.trackedEntityFinderResource.resource ===
                    'system/info'
                        ? {
                              calendar,
                              dateFormat: 'YYYY-MM-DD',
                              version: '2.43.1',
                          }
                        : {
                              displayName: name,
                              trackedEntityType: { id: 'tet' },
                              programTrackedEntityAttributes: [],
                          },
            }))
            return { client: createFinderResourceClient({ query }), query }
        }
        const first = source('First source', 'gregorian')
        const second = source('Second source', 'ethiopian')
        const queries = new QueryClient()
        try {
            for (const [server, name, calendar] of [
                [first, 'First source', 'gregorian'],
                [second, 'Second source', 'ethiopian'],
                [first, 'First source', 'gregorian'],
            ] as const) {
                expect(
                    (
                        await queries.fetchQuery(
                            programMetadataQueryOptions(
                                server.client,
                                'same-program'
                            )
                        )
                    ).name
                ).toBe(name)
                expect(
                    (
                        await queries.fetchQuery(
                            systemInfoQueryOptions(server.client)
                        )
                    ).calendar
                ).toBe(calendar)
                expect(server.query).toHaveBeenCalledTimes(2)
            }
        } finally {
            queries.clear()
        }
    })

    it('reloads program rules after their freshness window expires', async () => {
        const query = vi.fn(async () => ({
            trackedEntityFinderResource: {
                displayName: 'HIV',
                trackedEntityType: { id: 'tet' },
                minAttributesRequiredToSearch: 1,
                programTrackedEntityAttributes: [],
            },
        }))
        const client = createFinderResourceClient({ query })
        const options = programMetadataQueryOptions(client, 'prog')
        const queryClient = new QueryClient()
        const now = Date.now()
        const clock = vi.spyOn(Date, 'now').mockReturnValue(now)
        try {
            await queryClient.fetchQuery(options)
            query.mockResolvedValue({
                trackedEntityFinderResource: {
                    displayName: 'HIV',
                    trackedEntityType: { id: 'tet' },
                    minAttributesRequiredToSearch: 2,
                    programTrackedEntityAttributes: [],
                },
            })
            expect(
                (await queryClient.fetchQuery(options))
                    .minAttributesRequiredToSearch
            ).toBe(1)
            expect(query).toHaveBeenCalledTimes(1)
            clock.mockReturnValue(now + 60 * 60_000 + 1)
            expect(
                (await queryClient.fetchQuery(options))
                    .minAttributesRequiredToSearch
            ).toBe(2)
            expect(query).toHaveBeenCalledTimes(2)
        } finally {
            clock.mockRestore()
            queryClient.clear()
        }
    })
})
