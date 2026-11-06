import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

/**
 * Catalog browsing works without a backend: prose, navigation, and code tabs
 * are static, and controlled (non-live) examples render without DHIS2.
 */
test.describe('documentation catalog', () => {
    test('renders the introduction and sidebar navigation', async ({
        page,
    }) => {
        await page.goto('/')

        await expect(
            page.getByRole('heading', { name: 'DHIS2 Blocks' })
        ).toBeVisible()

        const docsNav = page.getByRole('navigation', {
            name: 'Documentation',
        })

        await expect(
            docsNav.getByRole('link', { name: 'Working List' })
        ).toBeVisible()
        await expect(
            docsNav.getByRole('link', { name: 'Context Selector' })
        ).toBeVisible()
    })

    test('shows installation and API guidance on the Working List page', async ({
        page,
    }) => {
        await page.goto('/blocks/working-list')

        await expect(
            page.getByRole('heading', { name: 'Working List' })
        ).toBeVisible()
        await expect(
            page.getByText('pnpm dlx shadcn@latest add').first()
        ).toBeVisible()

        // The Code tab renders the same example source the preview executes.
        await page.getByRole('tab', { name: 'code' }).first().click()

        const codePanel = page
            .locator('pre code')
            .filter({ hasText: 'WorkingList' })
            .first()

        await expect(codePanel).toBeVisible()

        const fullscreen = page.getByRole('link', {
            name: 'Open full screen',
        })

        await expect(fullscreen.first()).toHaveAttribute(
            'href',
            '/preview/working-list/default'
        )
    })

    test('renders controlled examples without a backend', async ({ page }) => {
        await page.goto('/blocks/context-selector')

        await expect(
            page.getByRole('heading', { name: 'Context Selector' })
        ).toBeVisible()

        // The registration-context example is controlled sample data, so it
        // renders inline in the page even while signed out or offline.
        await expect(
            page.getByRole('toolbar', { name: 'Registration context' })
        ).toBeVisible({
            timeout: 30_000,
        })
        await expect(
            page.getByText('Malaria case registration').first()
        ).toBeVisible()
    })

    test('documents installation', async ({ page }) => {
        await page.goto('/getting-started')

        await expect(page).toHaveURL(/\/installation$/)
        await expect(
            page.getByRole('heading', { name: 'Installation', exact: true })
        ).toBeVisible()
        await expect(
            page.getByRole('heading', { name: 'Initialize shadcn' })
        ).toBeVisible()
        await expect(
            page.getByText('add devotta-labs/dhis2-blocks/working-list').first()
        ).toBeVisible()
    })
})

/**
 * The OS contrast setting reaches a built docs example: more contrast swaps the
 * theme roles, and forced colours keeps the sidebar's current-page bar.
 */
test.describe('contrast', () => {
    const workspace = (page: Page) =>
        page.getByRole('navigation', { name: 'Workspace navigation' }).first()

    test('the sidebar example uses the high-contrast values', async ({
        page,
    }) => {
        await page.emulateMedia({ contrast: 'more' })
        await page.goto('/blocks/sidebar')
        const link = workspace(page).getByRole('link', { name: 'Dashboard' })
        await expect(link).toHaveCSS('color', 'rgb(251, 252, 253)')
    })

    test('the sidebar example keeps its current-page bar in forced colours', async ({
        page,
    }) => {
        await page.emulateMedia({ forcedColors: 'active' })
        await page.goto('/blocks/sidebar')
        const current = workspace(page).locator('[aria-current="page"]')
        const [bar, text] = await current.evaluate((element) => [
            getComputedStyle(element, '::before').backgroundColor,
            getComputedStyle(element).color,
        ])
        expect(bar).toBe(text)
    })
})
