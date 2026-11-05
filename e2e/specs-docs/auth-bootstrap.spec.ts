import { resolve } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { createStrictModeServer } from '../../apps/docs/src/playground/__tests__/strictModeServer'

const examples = [
    'Default Working List',
    'Metadata-driven Working List',
    'Working List as a calendar',
] as const

const exampleCard = (page: Page, name: (typeof examples)[number]) =>
    page.locator('.not-prose').filter({
        has: page.getByRole('tablist', {
            name: `${name} example`,
            exact: true,
        }),
    })

const expectReady = async (page: Page, name: (typeof examples)[number]) => {
    const card = exampleCard(page, name)
    await expect(card.getByTestId('working-list-main')).toBeVisible()
    if (name === 'Working List as a calendar') {
        const calendar = card.getByRole('region', {
            name: 'Calendar',
            exact: true,
        })
        await expect(calendar.getByRole('grid')).toHaveAttribute(
            'aria-busy',
            'false',
            { timeout: 30_000 }
        )
        await expect(
            calendar.getByRole('combobox', { name: 'Month', exact: true })
        ).toBeVisible()
        await expect(card.getByTestId('working-list-table')).toHaveCount(0)
    } else {
        await expect(
            card.getByTestId('working-list-table').locator('tbody')
        ).toHaveAttribute('aria-busy', 'false', { timeout: 30_000 })
        await expect(
            card.locator('[data-testid^="working-list-row-"]').first()
        ).toBeVisible()
    }
}

const watchBootstrap = async (page: Page) => {
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
    // Catch even a login modal that mounts and disappears between assertions.
    await page.addInitScript(() => {
        const selector = '[data-test="dhis2-adapter-loginmodal"]'
        new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (
                        node instanceof Element &&
                        (node.matches(selector) || node.querySelector(selector))
                    ) {
                        document.documentElement.dataset.docsLoginMounted =
                            'true'
                    }
                }
            }
        }).observe(document, { childList: true, subtree: true })
        const fetch = window.fetch
        window.fetch = (input, init) => {
            const url = input instanceof Request ? input.url : String(input)
            if (/\/api\/(system\/info|me)$/.test(url)) {
                init?.signal?.addEventListener(
                    'abort',
                    () => {
                        const data = document.documentElement.dataset
                        data.docsBootstrapAborts = String(
                            Number(data.docsBootstrapAborts ?? 0) + 1
                        )
                    },
                    { once: true }
                )
            }
            return fetch(input, init)
        }
    })
    return errors
}

test.describe('preview authentication bootstrap', () => {
    test('loads the inline previews without ever mounting a login dialog', async ({
        page,
    }) => {
        const errors = await watchBootstrap(page)
        await page.goto('/blocks/working-list')
        for (const name of examples) await expectReady(page, name)
        await expect(page.locator('html')).not.toHaveAttribute(
            'data-docs-login-mounted',
            'true'
        )
        expect(errors).toEqual([])
    })

    test('ignores aborted bootstrap attempts during development Strict Mode replay', async ({
        page,
    }) => {
        test.setTimeout(120_000)
        // Only this regression runs in development; the normal suite still tests the production preview.
        const server = await createStrictModeServer(
            resolve(__dirname, '../../apps/docs')
        )
        try {
            await server.listen()
            const errors = await watchBootstrap(page)
            await page.goto(
                new URL('/blocks/working-list', server.resolvedUrls!.local[0])
                    .href
            )
            for (const name of examples) await expectReady(page, name)
            await expect(page.locator('html')).toHaveAttribute(
                'data-docs-bootstrap-aborts',
                /^[1-9]\d*$/
            )
            await expect(page.locator('html')).not.toHaveAttribute(
                'data-docs-login-mounted',
                'true'
            )
            expect(errors).toEqual([])
        } finally {
            await page.goto('about:blank').finally(() => server.close())
        }
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
            for (const name of examples) {
                await expect(
                    exampleCard(page, name).getByText(
                        'Live preview unavailable.',
                        { exact: true }
                    )
                ).toBeVisible()
            }
            await expect(
                page.getByRole('heading', { name: 'Please sign in' })
            ).toHaveCount(0)

            const first = exampleCard(page, 'Default Working List')
            await first.getByRole('tab', { name: 'code', exact: true }).click()
            await expect(first.locator('pre code')).toBeVisible()
            await first
                .getByRole('tab', { name: 'preview', exact: true })
                .click()
            await page.unroute('**/dhis2/**')
            for (const name of examples) {
                await exampleCard(page, name)
                    .getByRole('button', { name: 'Retry preview' })
                    .click()
                await expectReady(page, name)
            }
            await expect(
                page.getByText('Live preview unavailable.', { exact: true })
            ).toHaveCount(0)
        })
    }
})
