import {
    test as base,
    expect,
    type APIRequestContext,
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

/** An error response a test provokes on purpose: its status and URL path. */
type ExpectedHttpFailure = {
    status: number
    path: RegExp
}

type DiagnosticAllowances = {
    allowOfflineRequestFailures: boolean
    expectedHttpFailures: ExpectedHttpFailure[]
}

type E2EFixtures = DiagnosticAllowances & {
    dhis2: APIRequestContext
    e2eCredentials: E2ECredentials
    page: Page
}

const environment = process.env
const username = environment?.E2E_DHIS2_USERNAME ?? 'admin'
const password = environment?.E2E_DHIS2_PASSWORD ?? 'district'

export type E2ECredentials = {
    username: string
    password: string
}

const e2eEnvironment = {
    appUrl: environment?.E2E_APP_URL,
    dhis2Url: environment?.E2E_DHIS2_URL,
    proxyUrl: environment?.E2E_PROXY_URL,
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

// Chrome logs each error response as "Failed to load resource: the server
// responded with a status of 409 (Conflict)" besides the response itself.
const isExpectedHttpFailure = (
    diagnostic: BrowserDiagnostic,
    path: string,
    { status, path: pattern }: ExpectedHttpFailure
) =>
    pattern.test(path) &&
    ((diagnostic.kind === 'http' && diagnostic.status === status) ||
        (diagnostic.kind === 'console' &&
            diagnostic.message.includes(
                `the server responded with a status of ${status}`
            )))

const isKnownBenignDiagnostic = (
    diagnostic: BrowserDiagnostic,
    { allowOfflineRequestFailures, expectedHttpFailures }: DiagnosticAllowances
) => {
    const path = urlPath(diagnostic.url ?? diagnostic.location?.url)
    if (
        expectedHttpFailures.some((expected) =>
            isExpectedHttpFailure(diagnostic, path ?? '', expected)
        )
    ) {
        return true
    }
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
        diagnostic.message.includes(
            'FetchError: An unknown error occurred - Not Found (404)'
        ) &&
        diagnostic.location?.url.includes('/node_modules/.vite/deps/')
    ) {
        // The DHIS2 app shell logs the separately allowlisted missing banner.
        // Any other 404 is still caught by its HTTP response diagnostic.
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
        diagnostic.kind === 'requestfailed' &&
        diagnostic.message === 'net::ERR_BLOCKED_BY_ORB' &&
        diagnostic.method === 'GET' &&
        /\/api(?:\/\d+)?\/icons\/[^/]+\/icon$/.test(path ?? '')
    ) {
        return true
    }

    return (
        allowOfflineRequestFailures &&
        diagnostic.kind === 'requestfailed' &&
        path === '/api/ping' &&
        /ERR_INTERNET_DISCONNECTED|ERR_NETWORK_CHANGED/.test(diagnostic.message)
    )
}

const signInToApp = async (
    page: Page,
    credentials: E2ECredentials = { username, password }
) => {
    const signInDialog = page.getByRole('dialog')
    await signInDialog
        .waitFor({ state: 'visible', timeout: 5_000 })
        .catch(() => undefined)
    if (!(await signInDialog.isVisible())) {
        return
    }

    await signInDialog
        .getByRole('heading', { name: 'Please sign in' })
        .waitFor()
    const serverUrl = e2eEnvironment.proxyUrl ?? e2eEnvironment.dhis2Url
    if (!serverUrl) {
        throw new Error(
            'E2E_PROXY_URL or E2E_DHIS2_URL is required to sign in.'
        )
    }

    await signInDialog.getByRole('textbox', { name: 'Server' }).fill(serverUrl)
    await signInDialog
        .getByRole('textbox', { name: 'Username' })
        .fill(credentials.username)
    await signInDialog
        .getByRole('textbox', { name: 'Password' })
        .fill(credentials.password)
    await signInDialog.getByRole('button', { name: 'Sign in' }).click()
    await signInDialog.waitFor({ state: 'hidden', timeout: 30_000 })
}

export const test = base.extend<E2EFixtures>({
    allowOfflineRequestFailures: [false, { option: true }],
    expectedHttpFailures: [[], { option: true }],
    e2eCredentials: [{ username, password }, { option: true }],
    dhis2: async ({ playwright }, use) => {
        const baseURL = environment?.E2E_DHIS2_URL
        if (!baseURL) {
            throw new Error(
                'E2E_DHIS2_URL is required. Start a target with scripts/e2e/up.sh first.'
            )
        }

        const api = await playwright.request.newContext({
            baseURL,
            extraHTTPHeaders: {
                Accept: 'application/json',
                Authorization: `Basic ${globalThis.btoa(`${username}:${password}`)}`,
            },
        })

        await use(api)
        await api.dispose()
    },
    page: async (
        {
            allowOfflineRequestFailures,
            expectedHttpFailures,
            e2eCredentials,
            page,
        },
        use,
        testInfo
    ) => {
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

        const response = await page.goto('/')
        if (!response?.ok()) {
            throw new Error(
                `The app shell returned HTTP ${response?.status() ?? 'unknown'} at ${page.url()}`
            )
        }

        await signInToApp(page, e2eCredentials)

        await use(page)

        page.off('console', onConsole)
        page.off('pageerror', onPageError)
        page.off('requestfailed', onRequestFailed)
        page.off('response', onResponse)

        const unexpectedDiagnostics = diagnostics.filter(
            (diagnostic) =>
                !isKnownBenignDiagnostic(diagnostic, {
                    allowOfflineRequestFailures,
                    expectedHttpFailures,
                })
        )
        if (
            unexpectedDiagnostics.length > 0 ||
            testInfo.status !== testInfo.expectedStatus
        ) {
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
        }
        if (unexpectedDiagnostics.length > 0) {
            throw new Error(
                `Unexpected browser/network diagnostics:\n${JSON.stringify(unexpectedDiagnostics, null, 2)}`
            )
        }
    },
})

export { expect }
