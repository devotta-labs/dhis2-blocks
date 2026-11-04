import type { WorkingListPage } from '../query/fetchers'
import { fetchDateRangePages } from './useWorkingListDateRange'

const page = (
    { page, pageSize }: { page: number; pageSize: number },
    count: number,
    hasNextPage: boolean
): WorkingListPage => ({
    mode: 'trackedEntity',
    records: Array.from({ length: count }, () => ({
        // SAFETY: Paging only counts records, so their content is irrelevant.
        trackedEntity: {} as never,
        values: {},
        issues: [],
    })),
    page,
    pageSize,
    hasNextPage,
})

describe('date range paging', () => {
    it('stops after a first page that is not full', async () => {
        const fetchPage = vi.fn(async (pagination) =>
            page(pagination, 12, false)
        )

        const result = await fetchDateRangePages(fetchPage, 1000)

        expect(fetchPage).toHaveBeenCalledTimes(1)
        expect(fetchPage).toHaveBeenCalledWith({ page: 1, pageSize: 200 })
        expect(result.truncated).toBe(false)
    })

    it('loads the rest of the limit together once the first page is full', async () => {
        const pending: Array<() => void> = []
        const fetchPage = vi.fn(
            (pagination: { page: number; pageSize: number }) =>
                pagination.page === 1
                    ? Promise.resolve(page(pagination, 200, true))
                    : new Promise<WorkingListPage>((resolve) =>
                          pending.push(() =>
                              resolve(
                                  page(pagination, 200, pagination.page < 3)
                              )
                          )
                      )
        )

        const result = fetchDateRangePages(fetchPage, 450)
        await vi.waitFor(() => expect(pending).toHaveLength(2))
        pending.forEach((resolve) => resolve())

        expect(fetchPage.mock.calls.map(([{ page }]) => page)).toEqual([
            1, 2, 3,
        ])
        // 600 records came back for a limit of 450.
        expect((await result).truncated).toBe(true)
    })

    it('is complete when the last page has no next page', async () => {
        const fetchPage = vi.fn(async (pagination) =>
            page(
                pagination,
                pagination.page === 1 ? 200 : 40,
                pagination.page === 1
            )
        )

        const result = await fetchDateRangePages(fetchPage, 400)

        expect(result.pages).toHaveLength(2)
        expect(result.truncated).toBe(false)
    })
})
