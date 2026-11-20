import { resolveWorkingListCapabilities } from '../api/capabilities'
import type { WorkingListPagination } from '../domain/model'
import { fetchWorkingListPage } from '../query/fetchers'
import { openWorkingListServer } from '../test/workingListServer'
import { fetchDateRangePages } from './useWorkingListDateRange'

const programId = 'Program0001'
const page = (
    pageNumber: number,
    pageSize: number,
    count: number,
    hasNextPage: boolean
) => {
    const pager = { page: pageNumber, pageSize }
    return Response.json({
        trackedEntities: Array.from({ length: count }, (_, index) => ({
            trackedEntity: `T${String((pageNumber - 1) * pageSize + index).padStart(10, '0')}`,
            attributes: [],
            programOwners: [],
        })),
        pager: hasNextPage
            ? { ...pager, nextPage: `?page=${pageNumber + 1}` }
            : pager,
    })
}

const setup = async (
    respond: (
        pageNumber: number,
        pageSize: number
    ) => Response | Promise<Response>
) => {
    const requests: WorkingListPagination[] = []
    const { client } = await openWorkingListServer(
        ({ pathname, searchParams }, { method }) => {
            if (
                method === 'GET' &&
                pathname.endsWith('/tracker/trackedEntities')
            ) {
                const pageNumber = Number(searchParams.get('page'))
                const pageSize = Number(searchParams.get('pageSize'))
                requests.push({ page: pageNumber, pageSize })
                return respond(pageNumber, pageSize)
            }
        }
    )
    const fetchPage = (pagination: WorkingListPagination) =>
        fetchWorkingListPage({
            client,
            context: { programId, orgUnitId: 'OrgUnit0001' },
            configuration: {
                mode: 'trackedEntity',
                programId,
                columns: ['createdAt'],
                sort: { fieldId: 'createdAt', direction: 'desc' },
                filters: [],
            },
            pagination,
            capabilities: resolveWorkingListCapabilities({ apiVersion: 43 }),
            fields: new Map(),
        })
    return { fetchPage, requests }
}

describe('date range paging', () => {
    it('stops after a first page that is not full', async () => {
        const { fetchPage, requests } = await setup((number, size) =>
            page(number, size, 12, false)
        )

        const result = await fetchDateRangePages(fetchPage, 1000)

        expect(requests).toEqual([{ page: 1, pageSize: 200 }])
        expect(result.truncated).toBe(false)
    })

    it('loads the rest of the limit together once the first page is full', async () => {
        const requestedSecond = Promise.withResolvers<void>()
        const requestedThird = Promise.withResolvers<void>()
        const release = Promise.withResolvers<void>()
        const { fetchPage, requests } = await setup(async (number, size) => {
            if (number === 2) requestedSecond.resolve()
            if (number === 3) requestedThird.resolve()
            if (number > 1) await release.promise
            return page(number, size, 200, number < 3)
        })

        const result = fetchDateRangePages(fetchPage, 450)
        try {
            await Promise.race([
                Promise.all([requestedSecond.promise, requestedThird.promise]),
                result.then(() => {
                    throw new Error(
                        'Pagination ended before both pages were requested'
                    )
                }),
            ])
        } finally {
            release.resolve()
        }

        const requestedPages = requests.map((request) => request.page)
        expect(requestedPages[0]).toBe(1)
        expect(requestedPages.slice(1).sort()).toEqual([2, 3])
        expect((await result).truncated).toBe(true)
    })

    it('is complete when the last page has no next page', async () => {
        const { fetchPage } = await setup((number, size) =>
            page(number, size, number === 1 ? 200 : 40, number === 1)
        )

        const result = await fetchDateRangePages(fetchPage, 400)

        expect(result.pages).toHaveLength(2)
        expect(result.truncated).toBe(false)
    })
})
