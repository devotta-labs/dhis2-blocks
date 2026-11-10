import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

/**
 * Live Tracked Entity Header preview coverage, against person `Y8aEiTpHSSQ`
 * (Irene Jacobs) in the WHO RMNCH Tracker in the Sierra Leone demo database
 * through the docs app's `/dhis2` proxy. The block's states and edge cases are
 * covered by its browser tests with fixtures.
 */
const SLUG = 'tracked-entity-header/person-banner'

const composedBanner = (page: Page) =>
    page.getByRole('region', { name: 'Irene Jacobs' })

test.describe('live Tracked Entity Header preview', () => {
    test('names the banner after the person and shows their birth date', async ({
        page,
    }) => {
        await page.goto(`/preview/${SLUG}`)

        const banner = composedBanner(page)

        await expect(banner).toBeVisible({ timeout: 30_000 })
        await expect(banner).toContainText('Birth date', { timeout: 30_000 })
        await expect(banner).toContainText('Not recorded')
    })

    test('has no serious accessibility violations', async ({ page }) => {
        await page.goto(`/preview/${SLUG}`)
        await expect(composedBanner(page)).toContainText('Birth date', {
            timeout: 30_000,
        })

        const accessibility = await new AxeBuilder({ page })
            .include('[data-slot="tracked-entity-banner"]')
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
            .analyze()

        expect(
            accessibility.violations.filter((violation) =>
                ['serious', 'critical'].includes(violation.impact ?? '')
            )
        ).toEqual([])
    })
})
