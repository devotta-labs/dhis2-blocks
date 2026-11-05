import type { Page, Response } from '@playwright/test'
import { z } from 'zod'

const createdList = z.object({ response: z.object({ uid: z.string().min(1) }) })

export const withOwnedTrackerLists = async (
    page: Page,
    run: () => Promise<void>
) => {
    const owned = new Set<string>()
    const captures: Promise<PromiseSettledResult<void>[]>[] = []
    const capture = (response: Response) => {
        const url = new URL(response.url())
        if (
            response.request().method() !== 'POST' ||
            !response.ok() ||
            !url.pathname.endsWith('/api/trackedEntityInstanceFilters')
        )
            return
        captures.push(
            Promise.allSettled([
                response.json().then((body) => {
                    const id = createdList.parse(body).response.uid
                    url.pathname += `/${id}`
                    url.search = ''
                    owned.add(url.href)
                }),
            ])
        )
    }
    const cleanup = async () => {
        const results = (await Promise.all(captures)).flat()
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
    page.on('response', capture)
    try {
        await run()
    } finally {
        page.off('response', capture)
        await cleanup()
    }
}
