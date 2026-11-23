import { openDhis2TestServer } from '../../../test/dhis2-server.test-utils'
import { Result } from 'better-result'
import { createOrgUnitResourceClient, type DataEngineValue } from './client'
import {
    fetchOrgUnitsById,
    fetchMe,
    SEARCH_PAGE_SIZE,
    searchOrgUnits,
} from './queries'

const engineReturning = async (resource: string, body: DataEngineValue) => {
    const requests: URL[] = []
    const { engine } = await openDhis2TestServer((url) => {
        requests.push(url)
        if (url.pathname === `/api/42/${resource}`) {
            return Response.json(body)
        }
        return undefined
    })
    return {
        client: createOrgUnitResourceClient(engine),
        params: () => Object.fromEntries(requests[0].searchParams),
    }
}

const unit = (id: string, displayName: string) => ({
    id,
    displayName,
    path: `/${id}`,
})

describe('fetchMe', () => {
    it('asks for the user and their units, sorted by name', async () => {
        const { client, params } = await engineReturning('me', {
            id: 'u1',
            organisationUnits: [
                { ...unit('b', 'Beta'), children: false },
                { ...unit('a', 'Alpha'), children: true },
            ],
        })

        const result = await fetchMe(client)

        expect(params()).toEqual({
            fields: 'id,organisationUnits[id,displayName,displayShortName,path,children::isNotEmpty]',
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
        const { engine } = await openDhis2TestServer((url) =>
            url.pathname === '/api/42/me' ? Response.error() : undefined
        )

        const result = await fetchMe(createOrgUnitResourceClient(engine))

        expect(Result.isError(result)).toBe(true)
    })
})

describe('searchOrgUnits', () => {
    it('searches within the user hierarchy, one page by name', async () => {
        const { client, params } = await engineReturning('organisationUnits', {
            pager: { page: 2, pageSize: 20, total: 21 },
            organisationUnits: [unit('a', 'Ngelehun')],
        })

        const result = await searchOrgUnits(client, 'ngel', 2)

        expect(params()).toEqual({
            query: 'ngel',
            withinUserHierarchy: 'true',
            fields: 'id,displayName,displayShortName,path',
            order: 'displayName:asc',
            pageSize: String(SEARCH_PAGE_SIZE),
            page: '2',
        })
        expect(result.unwrap()).toEqual({
            orgUnits: [unit('a', 'Ngelehun')],
            hasMore: false,
        })
    })

    it('sends no query for a blank one, and says a page follows', async () => {
        const { client, params } = await engineReturning('organisationUnits', {
            pager: { page: 1, pageSize: 20, total: 21 },
            organisationUnits: [unit('a', 'A')],
        })

        const result = await searchOrgUnits(client, '', 1)

        expect(params()).not.toHaveProperty('query')
        expect(result.unwrap().hasMore).toBe(true)
    })
})

describe('fetchOrgUnitsById', () => {
    it('asks for the ids in one unpaged request', async () => {
        const { client, params } = await engineReturning('organisationUnits', {
            organisationUnits: [unit('a', 'A'), unit('b', 'B')],
        })

        const result = await fetchOrgUnitsById(client, ['b', 'a'])

        expect(params()).toEqual({
            filter: 'id:in:[b,a]',
            withinUserHierarchy: 'true',
            fields: 'id,displayName,displayShortName,path',
            paging: 'false',
        })
        expect(result.unwrap()).toHaveLength(2)
    })
})
