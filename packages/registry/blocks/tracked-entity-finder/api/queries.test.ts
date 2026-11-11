import { QueryClient } from '@tanstack/react-query'
import { hivProgram } from '../__tests__/fixtures/program'
import { buildProgramModel } from '../rules/programModel'
import { seal } from '../rules/seal'
import { createFinderResourceClient, type DataEngineQuery } from './client'
import {
    finderKeys,
    programMetadataQueryOptions,
    searchQueryOptions,
} from './queries'
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
    const client = createFinderResourceClient({ query: vi.fn() })
    const filters = [
        { attribute: 'artNumber', conditions: [{ op: 'eq', value: 'A1' }] },
        {
            attribute: 'firstName',
            conditions: [{ op: 'like', value: 'Amina' }],
        },
    ] as const
    const search = seal(filters)

    it('keys searches only by program, canonical filters and page', () => {
        const key = finderKeys.search(client, 'p', search, 2)
        expect(key).toEqual([
            'tracked-entity-finder',
            'search',
            expect.any(Number),
            'p',
            ['artNumber:eq:A1', 'firstName:like:Amina'],
            2,
        ])
        expect(
            finderKeys.search(client, 'p', seal([...filters].reverse()), 2)
        ).toEqual(key)
        expect(finderKeys.search(client, 'other', search, 2)).not.toEqual(key)
        expect(finderKeys.search(client, 'p', search, 1)).not.toEqual(key)
        expect(
            finderKeys.search(client, 'p', seal([filters[0]]), 2)
        ).not.toEqual(key)
        const other = createFinderResourceClient({ query: vi.fn() })
        expect(finderKeys.search(other, 'p', search, 2)).not.toEqual(key)
        expect(finderKeys.program(other, 'p')).not.toEqual(
            finderKeys.program(client, 'p')
        )
        expect(finderKeys.systemInfo(other)).not.toEqual(
            finderKeys.systemInfo(client)
        )
    })

    it('reuses results for five minutes, then reloads them', async () => {
        const query = vi.fn(async () => ({
            trackedEntityFinderResource: {
                trackedEntities: [],
                pager: { total: 0 },
            },
        }))
        const client = createFinderResourceClient({ query })
        const options = searchQueryOptions(
            client,
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
        const client = createFinderResourceClient({ query })
        const options = systemInfoQueryOptions(client)
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
