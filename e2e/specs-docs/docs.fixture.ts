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

const bootstrapApiPath =
    /\/api(?:\/\d+)?\/(me|system\/info|loginConfig|userSettings)$/

const isAbortedBootstrapRead = (diagnostic: BrowserDiagnostic) =>
    diagnostic.kind === 'requestfailed' &&
    diagnostic.message === 'net::ERR_ABORTED' &&
    diagnostic.method === 'GET' &&
    bootstrapApiPath.test(urlPath(diagnostic.url) ?? '')

const DATA_ENTRY_SPEC = /(?:tracker-data-entry-[^/]*|accessibility)\.spec\.ts$/

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
        return true
    }

    if (
        diagnostic.kind === 'http' &&
        diagnostic.status === 401 &&
        bootstrapApiPath.test(path ?? '')
    ) {
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
        return true
    }

    if (
        DATA_ENTRY_SPEC.test(specFile) &&
        diagnostic.kind === 'console' &&
        /rule-engine[^/]*\.m?js$/.test(path ?? '') &&
        /^Rule .+ raised an error: (?:Failed to coerce value 'null'|Unknown variable: 'event_date')/.test(
            diagnostic.message
        )
    ) {
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

const workingListReady = async (page: Page) => {
    await expect(page.getByTestId('working-list-main')).toBeVisible({
        timeout: 30_000,
    })
    await expect(
        page.locator('[data-testid="working-list-table"] tbody')
    ).toHaveAttribute('aria-busy', 'false', { timeout: 30_000 })
}

/**
 * Opens a standalone preview route. The docs server injects demo
 * credentials into every proxied request (DOCS_DHIS2_USERNAME/
 * DOCS_DHIS2_PASSWORD), so previews are already signed in — no dialog
 * appears and the example renders straight to live data. `ready` waits
 * until the example has loaded; by default, until the Working List has.
 */
export const openLivePreview = async (
    page: Page,
    slug: string,
    ready: (page: Page) => Promise<void> = workingListReady
) => {
    await page.goto(`/preview/${slug}`)
    await ready(page)
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
