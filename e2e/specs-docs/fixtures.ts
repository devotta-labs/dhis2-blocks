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
    page: Page
}

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

// Paths the adapter's bootstrap probes before sign-in. The list is shared
// with the AbortError exemption below so both stay in sync.
const bootstrapApiPath =
    /\/api(?:\/\d+)?\/(me|system\/info|loginConfig|userSettings)$/

const isAbortedBootstrapRead = (diagnostic: BrowserDiagnostic) =>
    diagnostic.kind === 'requestfailed' &&
    diagnostic.message === 'net::ERR_ABORTED' &&
    diagnostic.method === 'GET' &&
    bootstrapApiPath.test(urlPath(diagnostic.url) ?? '')

// The data entry specs run program rules; no other spec does.
const DATA_ENTRY_SPEC = /data-entry-[^/]*\.spec\.ts$/

const isKnownBenignDiagnostic = (
    diagnostic: BrowserDiagnostic,
    specFile: string
) => {
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
        bootstrapApiPath.test(path ?? '')
    ) {
        // Signed-out previews probe these endpoints before the adapter shows
        // its sign-in dialog — the 401 is the expected trigger.
        return true
    }

    if (
        diagnostic.kind === 'console' &&
        diagnostic.message.includes('401') &&
        bootstrapApiPath.test(path ?? '')
    ) {
        return true
    }

    if (isAbortedBootstrapRead(diagnostic)) {
        // Navigating between examples aborts the adapter's bootstrap reads,
        // and React StrictMode remounts do the same under the dev server.
        return true
    }

    if (
        DATA_ENTRY_SPEC.test(specFile) &&
        diagnostic.kind === 'console' &&
        /rule-engine[^/]*\.m?js$/.test(path ?? '') &&
        /^Rule .+ raised an error: Failed to coerce value 'null'/.test(
            diagnostic.message
        )
    ) {
        // The DHIS2 rule engine logs, and skips, a rule that reads a value the
        // person lacks, such as an attribute of a person DHIS2 left out.
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
 * Opens a standalone preview route. The docs server injects demo
 * credentials into every proxied request (DOCS_DHIS2_USERNAME/
 * DOCS_DHIS2_PASSWORD), so previews are already signed in — no dialog
 * appears and the list renders straight to live data.
 */
export const openLivePreview = async (page: Page, slug: string) => {
    await page.goto(`/preview/${slug}`)
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

        // Each aborted bootstrap read surfaces a console AbortError too —
        // allow one console error per aborted request so an unrelated abort
        // later in the test is still reported.
        let consoleAbortAllowance = diagnostics.filter(
            isAbortedBootstrapRead
        ).length

        const unexpectedDiagnostics = diagnostics.filter((diagnostic) => {
            if (
                diagnostic.kind === 'console' &&
                diagnostic.message.includes('AbortError: signal is aborted') &&
                consoleAbortAllowance > 0
            ) {
                consoleAbortAllowance -= 1

                return false
            }

            return !isKnownBenignDiagnostic(diagnostic, testInfo.file)
        })

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
