import type { Page, Route } from '@playwright/test'
import { z } from 'zod'

const createdList = z.object({ response: z.object({ uid: z.string().min(1) }) })

export const withOwnedTrackerLists = async (
    page: Page,
    run: () => Promise<void>
) => {
    const owned = new Set<string>()
    const captures: Promise<PromiseSettledResult<void>[]>[] = []
    const matches = (url: URL) =>
        /\/api\/(?:\d+\/)?trackedEntityInstanceFilters$/.test(url.pathname)
    const capture = async (route: Route) => {
        if (route.request().method() !== 'POST') {
            await route.fallback()
            return
        }
        const pending = Promise.allSettled([
            (async () => {
                const response = await route.fetch().catch(async () => {
                    await route.abort()
                    return null
                })
                if (!response) return
                try {
                    if (!response.ok()) return
                    // Chromium may discard response bodies on navigation, so own the UID before delivery.
                    const body = await response.json()
                    const id = createdList.parse(body).response.uid
                    const url = new URL(route.request().url())
                    url.pathname += `/${id}`
                    url.search = ''
                    owned.add(url.href)
                } finally {
                    try {
                        await route.fulfill({ response })
                    } finally {
                        await response.dispose()
                    }
                }
            })(),
        ])
        captures.push(pending)
        await pending
    }
    const cleanup = async () => {
        const results: PromiseSettledResult<void>[] = []
        let settled = 0
        while (settled < captures.length) {
            const pending = captures.slice(settled)
            settled += pending.length
            results.push(...(await Promise.all(pending)).flat())
        }
        await page.unroute(matches, capture)
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
    await page.route(matches, capture)
    try {
        await run()
    } finally {
        await cleanup()
    }
}
