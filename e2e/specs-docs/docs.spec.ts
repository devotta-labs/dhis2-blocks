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
        // renders inside its iframe even while signed out or offline.
        const preview = page.frameLocator(
            'iframe[title="Registration context"]'
        )

        await expect(
            preview.getByRole('toolbar', { name: 'Registration context' })
        ).toBeVisible({
            timeout: 30_000,
        })
        await expect(
            preview.getByText('Malaria case registration')
        ).toBeVisible()
    })

    test('documents setup, proxying, and adding examples', async ({ page }) => {
        await page.goto('/getting-started')

        await expect(page.getByRole('heading', { name: 'Setup' })).toBeVisible()
        await expect(page.getByText('/dhis2').first()).toBeVisible()
    })
})
