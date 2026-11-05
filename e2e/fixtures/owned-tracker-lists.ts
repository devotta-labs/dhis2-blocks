import type { Page, Request } from '@playwright/test'
import { z } from 'zod'

const createdList = z.object({ response: z.object({ uid: z.string().min(1) }) })

export const withOwnedTrackerLists = async (
    page: Page,
    run: () => Promise<void>
) => {
    const owned = new Set<string>()
    const captures: Promise<PromiseSettledResult<void>[]>[] = []
    const capture = (request: Request) => {
        const url = new URL(request.url())
        if (
            request.method() !== 'POST' ||
            !url.pathname.endsWith('/api/trackedEntityInstanceFilters')
        )
            return
        captures.push(
            Promise.allSettled([
                request.response().then(async (response) => {
                    if (!response?.ok()) return
                    const body = await response.json()
                    const id = createdList.parse(body).response.uid
                    url.pathname += `/${id}`
                    url.search = ''
                    owned.add(url.href)
                }),
            ])
        )
    }
    const cleanup = async () => {
        const results: PromiseSettledResult<void>[] = []
        let settled = 0
        while (settled < captures.length) {
            const pending = captures.slice(settled)
            settled += pending.length
            results.push(...(await Promise.all(pending)).flat())
        }
        page.off('request', capture)
        const cleanup = await Promise.allSettled(
            [...owned].map(async (url) => {
                const response = await page.request.delete(url)
                if (![200, 204, 404].includes(response.status())) {
                    throw new Error(
                        `Owned list cleanup failed: HTTP ${response.status()} at ${url}`
                    )
                }
            })
        )
        const failures = [...results, ...cleanup].flatMap((result) =>
            result.status === 'rejected' ? [result.reason] : []
        )
        if (failures.length)
            throw new AggregateError(
                failures,
                'Owned tracker list cleanup failed'
            )
    }
    page.on('request', capture)
    try {
        await run()
    } finally {
        await cleanup()
    }
}
