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
})
