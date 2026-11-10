import { QueryClient } from '@tanstack/react-query'
import { createFinderResourceClient, type DataEngineQuery } from './client'
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
        expect(options.queryKey).toEqual(finderKeys.program('prog'))
        expect(options.gcTime).toBe(3 * 60 * 60_000)
    })

    it('keys searches by program, submission and page', () => {
        expect(finderKeys.search('p', { a: 'b' }, 2)).toEqual([
            'tracked-entity-finder',
            'search',
            'p',
            { a: 'b' },
            2,
        ])
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
