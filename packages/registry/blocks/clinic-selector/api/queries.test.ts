import { Result } from 'better-result'
import {
    createClinicResourceClient,
    type DataEngineLike,
    type DataEngineValue,
} from './client'
import {
    fetchClinicsById,
    fetchMe,
    SEARCH_PAGE_SIZE,
    searchClinics,
} from './queries'

const engineReturning = (body: DataEngineValue) => {
    const query = vi
        .fn<DataEngineLike['query']>()
        .mockResolvedValue({ clinicResource: body })
    return { client: createClinicResourceClient({ query }), query }
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
                fields: 'id,organisationUnits[id,displayName,path,children::isNotEmpty]',
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

        const result = await fetchMe(createClinicResourceClient({ query }))

        expect(Result.isError(result)).toBe(true)
    })
})

describe('searchClinics', () => {
    it('searches within the user hierarchy, one page', async () => {
        const { client, query } = engineReturning({
            pager: { total: 1 },
            organisationUnits: [unit('a', 'Ngelehun')],
        })

        const result = await searchClinics(client, 'ngel')

        expect(requestOf(query)).toEqual({
            resource: 'organisationUnits',
            params: {
                query: 'ngel',
                withinUserHierarchy: true,
                fields: 'id,displayName,path',
                pageSize: SEARCH_PAGE_SIZE,
            },
        })
        expect(result.unwrap()).toEqual({
            clinics: [unit('a', 'Ngelehun')],
            hasMore: false,
        })
    })

    it('reports more results than the page holds', async () => {
        const { client } = engineReturning({
            pager: { total: 51 },
            organisationUnits: Array.from({ length: 50 }, (_, i) =>
                unit(`u${i}`, `Unit ${i}`)
            ),
        })

        const result = await searchClinics(client, 'unit')

        expect(result.unwrap().hasMore).toBe(true)
    })
})

describe('fetchClinicsById', () => {
    it('asks for the ids in one unpaged request', async () => {
        const { client, query } = engineReturning({
            organisationUnits: [unit('a', 'A'), unit('b', 'B')],
        })

        const result = await fetchClinicsById(client, ['b', 'a'])

        expect(requestOf(query)).toEqual({
            resource: 'organisationUnits',
            params: {
                filter: 'id:in:[b,a]',
                withinUserHierarchy: true,
                fields: 'id,displayName,path',
                paging: false,
            },
        })
        expect(result.unwrap()).toHaveLength(2)
    })
})
