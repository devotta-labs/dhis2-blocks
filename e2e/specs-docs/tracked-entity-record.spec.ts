import { AxeBuilder } from '@axe-core/playwright'
import { expect, test } from './fixtures'

/**
 * Live Tracked Entity Record examples, against the Sierra Leone demo
 * database through the docs app's same-origin `/dhis2` proxy.
 * `PQfMcpmXeFE` is enrolled in Child Programme and TB program.
 */
test.describe('Tracked Entity Record examples', () => {
    test("renders the header example with PQfMcpmXeFE's attributes", async ({
        page,
    }) => {
        await page.goto('/preview/tracked-entity-record/header')

        const header = page.getByTestId('record-header')
        await expect(header).toBeVisible({ timeout: 30_000 })
        await expect(header.getByText('First name')).toBeVisible()
        await expect(header.getByText('John', { exact: true })).toBeVisible()
        await expect(header.getByText('Last name')).toBeVisible()
        await expect(header.getByText('Kelly', { exact: true })).toBeVisible()
    })

    test('renders both programs side by side', async ({ page }) => {
        await page.goto('/preview/tracked-entity-record/side-by-side')

        const child = page.getByRole('region', { name: 'Child Programme' })
        const tb = page.getByRole('region', { name: 'TB program' })
        await expect(child).toBeVisible({ timeout: 30_000 })
        await expect(tb).toBeVisible()
        await expect(child.getByText('Enrolled', { exact: true })).toBeVisible()
        await expect(tb.getByText('Enrolled', { exact: true })).toBeVisible()
    })

    test('renders visits with status labels', async ({ page }) => {
        await page.goto('/preview/tracked-entity-record/visits')

        const visits = page.getByRole('list', { name: 'Visits' })
        await expect(visits).toBeVisible({ timeout: 30_000 })

        const rows = visits.getByRole('listitem')
        await expect(rows.first()).toBeVisible()
        await expect(visits.getByText('In progress').first()).toBeVisible()

        // Every visit carries one of the derived status labels.
        for (const row of await rows.all()) {
            await expect(row).toContainText(
                /In progress|Completed|Upcoming|Overdue|Skipped/
            )
        }

        // A data element used in several stages is listed once.
        const labels = await page.locator('dt').allTextContents()
        expect(labels.length).toBeGreaterThan(0)
        expect(new Set(labels).size).toBe(labels.length)
    })

    test('the visits example tells an unavailable program from no enrollment', async ({
        page,
    }) => {
        // No metadata for the program reads as unavailable (spec 7.2, case 1).
        await page.route(/\/api(?:\/\d+)?\/programs\?/, (route) =>
            route.fulfill({ json: { programs: [] } })
        )
        await page.goto('/preview/tracked-entity-record/visits')

        await expect(
            page.getByText("You don't have access to this program's records.")
        ).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText('No current enrollment')).toHaveCount(0)
    })

    test('the visits example offers a retry when the program fails to load', async ({
        page,
    }) => {
        // An answer the block's schema rejects fails the program's metadata.
        await page.route(/\/api(?:\/\d+)?\/programs\?/, (route) =>
            route.fulfill({ json: {} })
        )
        await page.goto('/preview/tracked-entity-record/visits')

        await expect(
            page.getByText('This program could not be loaded.')
        ).toBeVisible({ timeout: 30_000 })
        await expect(
            page.getByRole('button', { name: 'Try again' })
        ).toBeVisible()
        await expect(page.getByText('No current enrollment')).toHaveCount(0)
    })

    test('renders the unavailable example', async ({ page }) => {
        await page.goto('/preview/tracked-entity-record/unavailable')

        await expect(
            page.getByText('This person is not available.')
        ).toBeVisible({ timeout: 30_000 })
    })

    test('the page has no axe violations', async ({ page }) => {
        await page.goto('/blocks/tracked-entity-record')

        await expect(
            page.getByRole('heading', { name: 'Tracked Entity Record' })
        ).toBeVisible()
        await expect(page.getByTestId('record-header')).toBeVisible({
            timeout: 30_000,
        })

        // The docs' code blocks use the github-light syntax theme, whose
        // orange tokens (#e36209) are 3.48:1 on white, under the 4.5:1 AA
        // minimum. That is the site's highlighter, not this page's content.
        const accessibility = await new AxeBuilder({ page })
            .exclude('[data-slot="code-block"]')
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
            .analyze()

        expect(accessibility.violations).toEqual([])
    })
})
