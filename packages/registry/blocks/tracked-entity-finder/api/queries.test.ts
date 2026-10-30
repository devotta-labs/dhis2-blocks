import { QueryClient } from '@tanstack/react-query'
import { createFinderResourceClient, type DataEngineQuery } from './client'
import { finderKeys, programMetadataQueryOptions } from './queries'

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
            'programTrackedEntityAttributes[searchable,displayInList,sortOrder,'
        )
        expect(fields).toContain('blockedSearchOperators')
        expect(options.queryKey).toEqual(finderKeys.program('prog'))
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
})
