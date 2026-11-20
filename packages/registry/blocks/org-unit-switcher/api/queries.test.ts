import { Result } from 'better-result'
import {
    createOrgUnitResourceClient,
    type DataEngineLike,
    type DataEngineValue,
} from './client'
import {
    fetchOrgUnitsById,
    fetchMe,
    SEARCH_PAGE_SIZE,
    searchOrgUnits,
} from './queries'

const engineReturning = (body: DataEngineValue) => {
    const query = vi
        .fn<DataEngineLike['query']>()
        .mockResolvedValue({ orgUnitResource: body })
    return { client: createOrgUnitResourceClient({ query }), query }
}

const requestOf = (query: ReturnType<typeof engineReturning>['query']) =>
    Object.values(query.mock.calls[0]?.[0] ?? {})[0]

const unit = (id: string, displayName: string) => ({
    id,
    displayName,
    path: `/${id}`,
})

describe('fetchMe', () => {
    it('asks for the user and their units, sorted by name', async () => {
        const { client, query } = engineReturning({
            id: 'u1',
            organisationUnits: [
                { ...unit('b', 'Beta'), children: false },
                { ...unit('a', 'Alpha'), children: true },
            ],
        })

        const result = await fetchMe(client)

        expect(requestOf(query)).toEqual({
            resource: 'me',
            params: {
                fields: 'id,organisationUnits[id,displayName,displayShortName,path,children::isNotEmpty]',
            },
        })
        expect(result.unwrap()).toEqual({
            userId: 'u1',
            assigned: [
                { ...unit('a', 'Alpha'), hasChildren: true },
                { ...unit('b', 'Beta'), hasChildren: false },
            ],
        })
    })

    it('returns an engine rejection as an error result', async () => {
        const query = vi
            .fn<DataEngineLike['query']>()
            .mockRejectedValue(new Error('offline'))

        const result = await fetchMe(createOrgUnitResourceClient({ query }))

        expect(Result.isError(result)).toBe(true)
    })
})

describe('searchOrgUnits', () => {
    it('searches within the user hierarchy, one page by name', async () => {
        const { client, query } = engineReturning({
            pager: { page: 2, pageSize: 20, total: 21 },
            organisationUnits: [unit('a', 'Ngelehun')],
        })

        const result = await searchOrgUnits(client, 'ngel', 2)

        expect(requestOf(query)).toEqual({
            resource: 'organisationUnits',
            params: {
                query: 'ngel',
                withinUserHierarchy: true,
                fields: 'id,displayName,displayShortName,path',
                order: 'displayName:asc',
                pageSize: SEARCH_PAGE_SIZE,
                page: 2,
            },
        })
        expect(result.unwrap()).toEqual({
            orgUnits: [unit('a', 'Ngelehun')],
            hasMore: false,
        })
    })

    it('sends no query for a blank one, and says a page follows', async () => {
        const { client, query } = engineReturning({
            pager: { page: 1, pageSize: 20, total: 21 },
            organisationUnits: [unit('a', 'A')],
        })

        const result = await searchOrgUnits(client, '', 1)

        expect(requestOf(query)?.params).not.toHaveProperty('query')
        expect(result.unwrap().hasMore).toBe(true)
    })
})

describe('fetchOrgUnitsById', () => {
    it('asks for the ids in one unpaged request', async () => {
        const { client, query } = engineReturning({
            organisationUnits: [unit('a', 'A'), unit('b', 'B')],
        })

        const result = await fetchOrgUnitsById(client, ['b', 'a'])

        expect(requestOf(query)).toEqual({
            resource: 'organisationUnits',
            params: {
                filter: 'id:in:[b,a]',
                withinUserHierarchy: true,
                fields: 'id,displayName,displayShortName,path',
                paging: false,
            },
        })
        expect(result.unwrap()).toHaveLength(2)
    })
})
