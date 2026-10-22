import { expect, test } from '@playwright/test'

test.describe('preview authentication bootstrap', () => {
    test('loads the inline previews without ever mounting a login dialog', async ({
        page,
    }) => {
        const errors: string[] = []

        page.on('pageerror', (error) => errors.push(error.message))
        page.on('console', (message) => {
            if (
                message.type() === 'error' &&
                message.text().includes('Network error')
            ) {
                errors.push(message.text())
            }
        })

        // Observe every mount, including dialogs that disappear before the
        // previews finish loading. Run against dev to exercise Strict Mode.
        await page.addInitScript(() => {
            const selector = '[data-test="dhis2-adapter-loginmodal"]'

            new MutationObserver((mutations) => {
                for (const mutation of mutations) {
                    for (const node of mutation.addedNodes) {
                        if (
                            node instanceof Element &&
                            (node.matches(selector) ||
                                node.querySelector(selector))
                        ) {
                            document.documentElement.dataset.docsLoginMounted =
                                'true'
                        }
                    }
                }
            }).observe(document, { childList: true, subtree: true })
        })

        await page.goto('/blocks/working-list')

        const lists = page.getByTestId('working-list-main')

        await expect(lists).toHaveCount(2)
        await expect(lists.nth(0)).toBeVisible()
        await expect(lists.nth(1)).toBeVisible()
        await expect(page.locator('html')).not.toHaveAttribute(
            'data-docs-login-mounted',
            'true'
        )
        expect(errors).toEqual([])
    })

    test('still asks for sign-in when the server rejects authentication', async ({
        page,
    }) => {
        await page.route(/\/dhis2\/api\/(system\/info|me)$/, (route) =>
            route.fulfill({
                status: 401,
                contentType: 'application/json',
                body: JSON.stringify({
                    httpStatus: 'Unauthorized',
                    httpStatusCode: 401,
                    message: 'Authentication required',
                }),
            })
        )

        await page.goto('/preview/working-list/default')
        await expect(
            page.getByRole('heading', { name: 'Please sign in' })
        ).toBeVisible()
        await expect(page.getByTestId('working-list-main')).toHaveCount(0)
    })

    for (const failure of ['network', 'unavailable', 'unauthorized']) {
        test(`keeps inline docs usable after a ${failure} failure and retries`, async ({
            page,
        }) => {
            await page.route('**/dhis2/**', (route) => {
                if (failure === 'network') {
                    return route.abort('failed')
                }

                const status = failure === 'unauthorized' ? 401 : 503
                return route.fulfill({
                    status,
                    contentType: 'application/json',
                    body: JSON.stringify({ httpStatusCode: status }),
                })
            })

            await page.goto('/blocks/working-list')
            await expect(
                page.getByText('Live preview unavailable.', { exact: true })
            ).toHaveCount(2)
            await expect(
                page.getByRole('heading', { name: 'Please sign in' })
            ).toHaveCount(0)

            await page.getByRole('tab', { name: 'code' }).first().click()
            await expect(page.locator('pre code').first()).toBeVisible()
            await page.getByRole('tab', { name: 'preview' }).first().click()
            await page.unroute('**/dhis2/**')
            for (const surface of await page
                .locator('.docs-preview-surface')
                .all()) {
                await surface
                    .getByRole('button', { name: 'Retry preview' })
                    .click()
                await expect(
                    surface.locator('[data-testid^="working-list-row-"]')
                ).toHaveCount(10, { timeout: 30_000 })
            }
            await expect(
                page.getByText('Live preview unavailable.', { exact: true })
            ).toHaveCount(0)
        })
    }
})
