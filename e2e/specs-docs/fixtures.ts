import {
    test as base,
    expect,
    type ConsoleMessage,
    type Page,
    type Request,
    type Response,
} from '@playwright/test'

type BrowserDiagnostic = {
    kind: 'console' | 'pageerror' | 'requestfailed' | 'http'
    message: string
    method?: string
    url?: string
    status?: number
    location?: ReturnType<ConsoleMessage['location']>
}

type DocsFixtures = {
    dhis2Credentials: { username: string; password: string }
    page: Page
}

const environment = process.env

const username = environment?.E2E_DHIS2_USERNAME ?? 'admin'

const password = environment?.E2E_DHIS2_PASSWORD ?? 'district'

const urlPath = (value?: string) => {
    if (!value) {
        return undefined
    }

    try {
        return new URL(value).pathname
    } catch {
        return undefined
    }
}

const isKnownBenignDiagnostic = (diagnostic: BrowserDiagnostic) => {
    const path = urlPath(diagnostic.url ?? diagnostic.location?.url)

    if (
        diagnostic.kind === 'http' &&
        diagnostic.status === 404 &&
        (path === '/favicon.ico' ||
            /\/api(?:\/\d+)?\/staticContent\/logo_banner$/.test(path ?? ''))
    ) {
        return true
    }

    if (
        diagnostic.kind === 'console' &&
        diagnostic.message.includes('Failed to load resource') &&
        /\/api(?:\/\d+)?\/staticContent\/logo_banner$/.test(path ?? '')
    ) {
        return true
    }

    if (
        diagnostic.kind === 'console' &&
        diagnostic.message.includes('Deprecated') &&
        diagnostic.location?.url.includes('moment')
    ) {
        return true
    }

    if (
        diagnostic.kind === 'requestfailed' &&
        diagnostic.message === 'net::ERR_ABORTED' &&
        diagnostic.method === 'GET' &&
        /\/api(?:\/\d+)?\/tracker\/(trackedEntities|events)$/.test(path ?? '')
    ) {
        // React Query aborts obsolete Tracker reads when the result level or
        // selected list changes.
        return true
    }

    if (
        diagnostic.kind === 'http' &&
        diagnostic.status === 401 &&
        /\/api(?:\/\d+)?\/(me|system\/info|loginConfig|userSettings)$/.test(
            path ?? ''
        )
    ) {
        // Signed-out previews probe these endpoints before the adapter shows
        // its sign-in dialog — the 401 is the expected trigger.
        return true
    }

    if (
        diagnostic.kind === 'console' &&
        diagnostic.message.includes('401') &&
        /\/api(?:\/\d+)?\/(me|system\/info|loginConfig|userSettings)$/.test(
            path ?? ''
        )
    ) {
        return true
    }

    if (
        diagnostic.kind === 'requestfailed' &&
        diagnostic.message === 'net::ERR_ABORTED' &&
        diagnostic.method === 'GET' &&
        /\/api(?:\/\d+)?\/(me|system\/info|loginConfig|userSettings)$/.test(
            path ?? ''
        )
    ) {
        // Navigating between examples aborts the adapter's bootstrap reads,
        // and React StrictMode remounts do the same under the dev server.
        return true
    }

    if (
        diagnostic.kind === 'console' &&
        diagnostic.message.includes('AbortError: signal is aborted')
    ) {
        // The aborted request above surfaces in the console too.
        return true
    }

    if (
        diagnostic.kind === 'requestfailed' &&
        diagnostic.message === 'net::ERR_BLOCKED_BY_ORB' &&
        diagnostic.method === 'GET' &&
        /\/api(?:\/\d+)?\/icons\/[^/]+\/icon$/.test(path ?? '')
    ) {
        return true
    }

    if (
        diagnostic.kind === 'requestfailed' &&
        diagnostic.message === 'net::ERR_ABORTED' &&
        diagnostic.method === 'GET' &&
        path === '/sw.js'
    ) {
        return true
    }

    return false
}

/**
 * Signs in through the app-adapter dialog inside a docs live preview. The
 * server field is hidden — previews are pinned to the same-origin `/dhis2`
 * proxy — so only credentials are required.
 */
export const signInToDocsPreview = async (
    page: Page,
    credentials: { username: string; password: string } = {
        username,
        password,
    }
) => {
    const signInDialog = page.getByRole('dialog')
    await signInDialog
        .getByRole('heading', { name: 'Please sign in' })
        .waitFor({ timeout: 30_000 })

    await signInDialog
        .getByRole('textbox', { name: 'Username' })
        .fill(credentials.username)
    await signInDialog
        .getByRole('textbox', { name: 'Password' })
        .fill(credentials.password)
    await signInDialog.getByRole('button', { name: 'Sign in' }).click()
    await signInDialog.waitFor({ state: 'hidden', timeout: 30_000 })
}

/** Opens a standalone preview route and completes the sign-in flow. */
export const openLivePreview = async (page: Page, slug: string) => {
    await page.goto(`/preview/${slug}`)
    await signInToDocsPreview(page)
    await expect(page.getByTestId('working-list-main')).toBeVisible({
        timeout: 30_000,
    })
    await expect(
        page.locator('[data-testid="working-list-table"] tbody')
    ).toHaveAttribute('aria-busy', 'false', { timeout: 30_000 })
}

export const resultRows = (page: Page) =>
    page.locator('[data-testid^="working-list-row-"]')

export const test = base.extend<DocsFixtures>({
    dhis2Credentials: [{ username, password }, { option: true }],
    page: async ({ page }, use, testInfo) => {
        const diagnostics: BrowserDiagnostic[] = []

        const onConsole = (message: ConsoleMessage) => {
            if (message.type() === 'error') {
                diagnostics.push({
                    kind: 'console',
                    message: message.text(),
                    location: message.location(),
                    url: message.location().url,
                })
            }
        }

        const onPageError = (error: Error) => {
            diagnostics.push({
                kind: 'pageerror',
                message: error.stack ?? error.message,
            })
        }

        const onRequestFailed = (request: Request) => {
            diagnostics.push({
                kind: 'requestfailed',
                message:
                    request.failure()?.errorText ?? 'Unknown request failure',
                method: request.method(),
                url: request.url(),
            })
        }

        const onResponse = (response: Response) => {
            if (response.status() >= 400) {
                diagnostics.push({
                    kind: 'http',
                    message: response.statusText(),
                    status: response.status(),
                    url: response.url(),
                })
            }
        }

        page.on('console', onConsole)
        page.on('pageerror', onPageError)
        page.on('requestfailed', onRequestFailed)
        page.on('response', onResponse)

        await use(page)

        page.off('console', onConsole)
        page.off('pageerror', onPageError)
        page.off('requestfailed', onRequestFailed)
        page.off('response', onResponse)

        const unexpectedDiagnostics = diagnostics.filter(
            (diagnostic) => !isKnownBenignDiagnostic(diagnostic)
        )

        if (unexpectedDiagnostics.length > 0) {
            await testInfo.attach('browser-network-console-diagnostics', {
                body: JSON.stringify(
                    {
                        unexpected: unexpectedDiagnostics,
                        allowlisted: diagnostics.filter(
                            (diagnostic) =>
                                !unexpectedDiagnostics.includes(diagnostic)
                        ),
                    },
                    null,
                    2
                ),
                contentType: 'application/json',
            })

            throw new Error(
                `Unexpected browser/network diagnostics:\n${JSON.stringify(unexpectedDiagnostics, null, 2)}`
            )
        }
    },
})

export { expect }
