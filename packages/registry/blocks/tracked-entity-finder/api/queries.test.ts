import { QueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { hivProgram } from '../__tests__/fixtures/program'
import { buildProgramModel } from '../rules/programModel'
import { seal } from '../rules/seal'
import {
    finderKeys,
    type FinderEngine,
    metadataQueryOptions,
    searchQueryOptions,
} from './queries'
import { systemInfoQueryOptions } from './systemInfo'

const server = 'https://dhis2.test'
const programScope = { kind: 'program', id: 'prog' } as const
type DataEngineQuery = Parameters<FinderEngine['query']>[0]

describe('program metadata query', () => {
    it('requests the program fields the rules need', async () => {
        const query = vi.fn(async (_query: DataEngineQuery) => ({
            trackedEntityFinderResource: {
                displayName: 'HIV',
                trackedEntityType: { id: 'tet' },
                programTrackedEntityAttributes: [],
            },
        }))
        const client = { query }
        const options = metadataQueryOptions(client, server, programScope)
        await new QueryClient().fetchQuery(options)

        const sent = query.mock.calls[0]?.[0]
        const request = sent?.trackedEntityFinderResource
        expect(request).toMatchObject({ resource: 'programs', id: 'prog' })
        const { fields } = z
            .object({ fields: z.string() })
            .parse(request?.params)
        expect(fields).toContain('minAttributesRequiredToSearch')
        expect(fields).toContain('maxTeiCountToReturn')
        expect(fields).toContain(
            'programTrackedEntityAttributes[searchable,displayInList,sortOrder,preferredSearchOperator,blockedSearchOperators,minCharactersToSearch,'
        )
        expect(fields).toContain('blockedSearchOperators')
        expect(options.queryKey).toEqual([
            'tracked-entity-finder',
            'program',
            server,
            'prog',
        ])
        expect(options.gcTime).toBe(3 * 60 * 60_000)
    })

    it("requests a tracked entity type's own rules without a program", async () => {
        const query = vi.fn(async (_query: DataEngineQuery) => ({
            trackedEntityFinderResource: {
                displayName: 'Person',
                minAttributesRequiredToSearch: 3,
                maxTeiCountToReturn: 50,
                trackedEntityTypeAttributes: [
                    {
                        searchable: true,
                        displayInList: true,
                        trackedEntityAttribute: {
                            id: 'firstName',
                            displayName: 'First name',
                            valueType: 'TEXT',
                        },
                    },
                ],
            },
        }))
        const scope = { kind: 'trackedEntityType', id: 'person' } as const
        const options = metadataQueryOptions({ query }, server, scope)
        const metadata = await new QueryClient().fetchQuery(options)

        const request = query.mock.calls[0]?.[0]?.trackedEntityFinderResource
        expect(request).toMatchObject({
            resource: 'trackedEntityTypes',
            id: 'person',
        })
        const { fields } = z
            .object({ fields: z.string() })
            .parse(request?.params)
        expect(fields).toContain('minAttributesRequiredToSearch')
        expect(fields).toContain('maxTeiCountToReturn')
        expect(fields).toContain(
            'trackedEntityTypeAttributes[searchable,displayInList,'
        )
        expect(metadata).toEqual({
            name: 'Person',
            trackedEntityType: 'person',
            minAttributesRequiredToSearch: 3,
            maxTeiCountToReturn: 50,
            attributes: [
                expect.objectContaining({ id: 'firstName', searchable: true }),
            ],
        })
        expect(metadata).not.toHaveProperty('program')
        expect(options.queryKey).toEqual(finderKeys.metadata(server, scope))
        expect(options.queryKey).not.toEqual(
            finderKeys.metadata(server, { kind: 'program', id: 'person' })
        )
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
        const client = { query }
        const options = metadataQueryOptions(client, server, programScope)
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
            clock.mockReturnValue(now + 3 * 60 * 60_000 - 1)
            expect(
                (await queryClient.fetchQuery(options))
                    .minAttributesRequiredToSearch
            ).toBe(1)
            expect(query).toHaveBeenCalledTimes(1)
            clock.mockReturnValue(now + 3 * 60 * 60_000)
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

describe('search query', () => {
    const filters = [
        { attribute: 'artNumber', conditions: [{ op: 'eq', value: 'A1' }] },
        {
            attribute: 'firstName',
            conditions: [{ op: 'like', value: 'Amina' }],
        },
    ] as const
    const search = seal(filters)

    it('keys searches by server, scope, canonical filters and page', () => {
        const p = { kind: 'program', id: 'p' } as const
        const key = finderKeys.search(server, p, search, 2)
        expect(key).toEqual([
            'tracked-entity-finder',
            'search',
            server,
            'program',
            'p',
            ['artNumber:eq:A1', 'firstName:like:Amina'],
            2,
        ])
        expect(
            finderKeys.search(server, p, seal([...filters].reverse()), 2)
        ).toEqual(key)
        expect(
            finderKeys.search(
                server,
                { kind: 'program', id: 'other' },
                search,
                2
            )
        ).not.toEqual(key)
        expect(
            finderKeys.search(
                server,
                { kind: 'trackedEntityType', id: 'p' },
                search,
                2
            )
        ).not.toEqual(key)
        expect(finderKeys.search(server, p, search, 1)).not.toEqual(key)
        expect(finderKeys.search(server, p, seal([filters[0]]), 2)).not.toEqual(
            key
        )
        expect(
            finderKeys.search('https://other.dhis2.test', p, search, 2)
        ).not.toEqual(key)
        expect(finderKeys.metadata('https://other.dhis2.test', p)).not.toEqual(
            finderKeys.metadata(server, p)
        )
        expect(finderKeys.systemInfo('https://other.dhis2.test')).not.toEqual(
            finderKeys.systemInfo(server)
        )
    })

    it('reuses results for five minutes, then reloads them', async () => {
        const query = vi.fn(async () => ({
            trackedEntityFinderResource: {
                trackedEntities: [],
                pager: { total: 0 },
            },
        }))
        const client = { query }
        const options = searchQueryOptions(
            client,
            server,
            buildProgramModel(hivProgram),
            search,
            1
        )
        const queryClient = new QueryClient()
        const now = Date.now()
        const clock = vi.spyOn(Date, 'now').mockReturnValue(now)
        try {
            expect(options.staleTime).toBe(5 * 60_000)
            expect(options.gcTime).toBe(5 * 60_000)
            await queryClient.fetchQuery(options)
            clock.mockReturnValue(now + 5 * 60_000 - 1)
            await queryClient.fetchQuery(options)
            expect(query).toHaveBeenCalledTimes(1)
            clock.mockReturnValue(now + 5 * 60_000)
            await queryClient.fetchQuery(options)
            expect(query).toHaveBeenCalledTimes(2)
        } finally {
            clock.mockRestore()
            queryClient.clear()
        }
    })
})

describe('system info metadata query', () => {
    it('reuses system info for three hours, then reloads it', async () => {
        const query = vi.fn(async () => ({
            trackedEntityFinderResource: {
                calendar: 'gregorian',
                dateFormat: 'yyyy-MM-dd',
                version: '2.43.0',
            },
        }))
        const client = { query }
        const options = systemInfoQueryOptions(client, server)
        const queryClient = new QueryClient()
        const now = Date.now()
        const clock = vi.spyOn(Date, 'now').mockReturnValue(now)
        try {
            expect(options.gcTime).toBe(3 * 60 * 60_000)
            await queryClient.fetchQuery(options)
            query.mockResolvedValue({
                trackedEntityFinderResource: {
                    calendar: 'ethiopian',
                    dateFormat: 'yyyy-MM-dd',
                    version: '2.43.0',
                },
            })
            clock.mockReturnValue(now + 3 * 60 * 60_000 - 1)
            expect((await queryClient.fetchQuery(options)).calendar).toBe(
                'gregorian'
            )
            expect(query).toHaveBeenCalledTimes(1)
            clock.mockReturnValue(now + 3 * 60 * 60_000)
            expect((await queryClient.fetchQuery(options)).calendar).toBe(
                'ethiopian'
            )
            expect(query).toHaveBeenCalledTimes(2)
        } finally {
            clock.mockRestore()
            queryClient.clear()
        }
    })
})
