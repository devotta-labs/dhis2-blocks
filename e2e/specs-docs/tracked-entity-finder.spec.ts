import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect, openLivePreview, test } from './fixtures'

/**
 * Live Tracked Entity Finder preview coverage, against the WHO RMNCH Tracker
 * in the Sierra Leone demo database through the docs app's `/dhis2` proxy.
 * The program's rule edge cases (minimum, cap, too many matches) are covered
 * by the block's browser tests with fixtures.
 */
const SLUG = 'tracked-entity-finder/find-person'

/** Fields render disabled until the program's metadata has loaded. */
const finderReady = async (page: Page) => {
    await expect(page.getByLabel('Unique ID')).toBeEnabled({
        timeout: 30_000,
    })
}

const search = (page: Page) =>
    page.getByRole('button', { name: 'Search', exact: true })

const trackedEntitySearch = (page: Page, action: () => Promise<void>) => {
    const request = page.waitForRequest(
        (candidate) =>
            candidate.url().includes('/tracker/trackedEntities') &&
            candidate.method() === 'GET',
        { timeout: 30_000 }
    )

    return action().then(() => request)
}

test.describe('live Tracked Entity Finder preview', () => {
    test('finds a person by ID and selects them', async ({ page }) => {
        await openLivePreview(page, SLUG, finderReady)

        await expect(search(page)).toBeDisabled()
        await page.getByLabel('Unique ID').fill('9411202')

        const request = await trackedEntitySearch(page, () =>
            search(page).click()
        )
        const url = new URL(request.url())

        // An ID is matched exactly, and the search never names org units.
        expect(url.searchParams.getAll('filter')).toEqual([
            'lZGmxYbs97q:eq:9411202',
        ])
        expect(url.searchParams.get('orgUnits')).toBeNull()
        expect(url.searchParams.get('orgUnitMode')).toBe('ACCESSIBLE')

        const row = page.getByRole('button', { name: /Linda/ })
        await expect(row).toHaveCount(1, { timeout: 30_000 })
        await row.click()

        await expect(page.getByText('Selected k4ODejBytgv')).toBeVisible()
    })

    test('No ID? searches by first name and birth date', async ({ page }) => {
        await openLivePreview(page, SLUG, finderReady)

        await page.getByRole('button', { name: 'No ID?' }).click()
        await expect(page.getByLabel('Unique ID')).toHaveCount(0)
        await expect(page.getByLabel('First name')).toBeEnabled()

        // Nothing entered yet: there is nothing to search with.
        await expect(search(page)).toBeDisabled()
        // An empty form has no hint. With this program's minimum of 1, one
        // filled detail is enough, so "Add 1 more detail" never shows here;
        // the block's browser tests cover the minimum.
        await expect(page.locator('[data-slot="finder-hint"]')).toHaveCount(0)

        await page.getByLabel('First name').fill('Rose')
        await page.getByLabel('Birth date').fill('1989-07-04')
        // The calendar input reports a typed date when it loses focus.
        await page.getByLabel('Birth date').press('Tab')

        const request = await trackedEntitySearch(page, () =>
            search(page).click()
        )

        const url = new URL(request.url())

        expect(url.searchParams.getAll('filter')).toContain(
            'gHGyrwKPzej:eq:1989-07-04'
        )
        expect(url.searchParams.get('orgUnitMode')).toBe('ACCESSIBLE')

        await expect(
            page.getByRole('button', { name: /Rose.*Hudson/ })
        ).toBeVisible({ timeout: 30_000 })

        await page.getByRole('button', { name: 'Search by ID instead' }).click()
        await expect(page.getByLabel('Unique ID')).toBeVisible()
    })

    test('has no serious accessibility violations', async ({ page }) => {
        await openLivePreview(page, SLUG, finderReady)

        await page.getByLabel('Unique ID').fill('9411202')
        await search(page).click()
        await expect(page.getByRole('button', { name: /Linda/ })).toBeVisible({
            timeout: 30_000,
        })

        const accessibility = await new AxeBuilder({ page })
            .include('[data-slot="finder-form"]')
            .include('[data-slot="finder-results"]')
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
            .analyze()

        expect(
            accessibility.violations.filter((violation) =>
                ['serious', 'critical'].includes(violation.impact ?? '')
            )
        ).toEqual([])
    })
})
