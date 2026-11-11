import { QueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { hivProgram } from '../__tests__/fixtures/program'
import { buildProgramModel } from '../rules/programModel'
import { seal } from '../rules/seal'
import {
    finderKeys,
    type FinderEngine,
    programMetadataQueryOptions,
    searchQueryOptions,
} from './queries'
import { systemInfoQueryOptions } from './systemInfo'

const server = 'https://dhis2.test'
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
        const options = programMetadataQueryOptions(client, server, 'prog')
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
        expect(options.queryKey).toEqual(finderKeys.program(server, 'prog'))
        expect(options.gcTime).toBe(3 * 60 * 60_000)
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
        const options = programMetadataQueryOptions(client, server, 'prog')
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

    it('keys searches by server, program, canonical filters and page', () => {
        const key = finderKeys.search(server, 'p', search, 2)
        expect(key).toEqual([
            'tracked-entity-finder',
            'search',
            server,
            'p',
            ['artNumber:eq:A1', 'firstName:like:Amina'],
            2,
        ])
        expect(
            finderKeys.search(server, 'p', seal([...filters].reverse()), 2)
        ).toEqual(key)
        expect(finderKeys.search(server, 'other', search, 2)).not.toEqual(key)
        expect(finderKeys.search(server, 'p', search, 1)).not.toEqual(key)
        expect(
            finderKeys.search(server, 'p', seal([filters[0]]), 2)
        ).not.toEqual(key)
        expect(
            finderKeys.search('https://other.dhis2.test', 'p', search, 2)
        ).not.toEqual(key)
        expect(finderKeys.program('https://other.dhis2.test', 'p')).not.toEqual(
            finderKeys.program(server, 'p')
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
