import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

/**
 * Live Observation Cards preview coverage, against person `Y8aEiTpHSSQ` in the
 * WHO RMNCH Tracker in the Sierra Leone demo database through the docs app's
 * `/dhis2` proxy. The block's states and edge cases are covered by its browser
 * tests with fixtures.
 */
const SLUG = 'observation-cards/person-vitals'

const haemoglobinCard = (page: Page) =>
    page.getByRole('group', { name: /Hemoglobin/i })

test.describe('live Observation Cards preview', () => {
    test('shows the haemoglobin value, its unit and when it was recorded', async ({
        page,
    }) => {
        await page.goto(`/preview/${SLUG}`)

        const card = haemoglobinCard(page)

        await expect(card).toBeVisible({ timeout: 30_000 })
        await expect(
            card.locator('[data-slot="observation-value"]')
        ).toHaveText(/\d.*g\/dL/, { timeout: 30_000 })
        await expect(card.locator('[data-slot="recorded-note"]')).toContainText(
            /Recorded .+ · .+/
        )
    })

    test('has no serious accessibility violations', async ({ page }) => {
        await page.goto(`/preview/${SLUG}`)
        await expect(
            haemoglobinCard(page).locator('[data-slot="recorded-note"]')
        ).toBeVisible({ timeout: 30_000 })

        const accessibility = await new AxeBuilder({ page })
            .include('[data-slot="observation-card"]')
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
            .analyze()

        expect(
            accessibility.violations.filter((violation) =>
                ['serious', 'critical'].includes(violation.impact ?? '')
            )
        ).toEqual([])
    })
})
