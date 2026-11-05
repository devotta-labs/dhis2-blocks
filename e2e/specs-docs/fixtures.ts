import { test as base, expect, type Page } from '@playwright/test'
import { withBrowserDiagnostics } from '../fixtures/browser-diagnostics'
import { unexpectedDocsDiagnostics } from './diagnostic-policy'

// The docs proxy injects demo credentials; authentication belongs to the host,
// while each block caller owns its own readiness.
export const openLivePreview = async (
    page: Page,
    slug: string,
    ready?: (page: Page) => Promise<void>
) => {
    const response = await page.goto(`/preview/${slug}`)
    expect(response?.ok(), `Preview navigation failed at ${page.url()}`).toBe(
        true
    )
    await ready?.(page)
}

export const test = base.extend<{ page: Page }>({
    page: async ({ page }, use, testInfo) =>
        withBrowserDiagnostics({
            page,
            testInfo,
            unexpected: unexpectedDocsDiagnostics,
            run: () => use(page),
        }),
})
export { expect }
