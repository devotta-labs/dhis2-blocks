import type {
    ConsoleMessage,
    Page,
    Request,
    Response,
    TestInfo,
} from '@playwright/test'

export type BrowserDiagnostic = {
    kind: 'console' | 'pageerror' | 'requestfailed' | 'http'
    message: string
    method?: string
    url?: string
    status?: number
    location?: ReturnType<ConsoleMessage['location']>
}

export const urlPath = (value?: string) => {
    if (!value) return undefined
    try {
        return new URL(value).pathname
    } catch {
        return undefined
    }
}

type DiagnosticPolicy = (
    diagnostics: BrowserDiagnostic[]
) => BrowserDiagnostic[]

type DiagnosticRun = {
    page: Page
    testInfo: Pick<TestInfo, 'status' | 'expectedStatus' | 'attach'>
    unexpected: DiagnosticPolicy
    run: () => Promise<void>
}

export const withBrowserDiagnostics = async ({
    page,
    testInfo,
    unexpected,
    run,
}: DiagnosticRun) => {
    const diagnostics: BrowserDiagnostic[] = []
    const onConsole = (message: ConsoleMessage) => {
        if (message.type() === 'error')
            diagnostics.push({
                kind: 'console',
                message: message.text(),
                location: message.location(),
                url: message.location().url,
            })
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
            message: request.failure()?.errorText ?? 'Unknown request failure',
            method: request.method(),
            url: request.url(),
        })
    }
    const onResponse = (response: Response) => {
        if (response.status() >= 400)
            diagnostics.push({
                kind: 'http',
                message: response.statusText(),
                status: response.status(),
                url: response.url(),
            })
    }
    page.on('console', onConsole)
    page.on('pageerror', onPageError)
    page.on('requestfailed', onRequestFailed)
    page.on('response', onResponse)

    let failed = false
    const report = async () => {
        const errors = unexpected(diagnostics)
        // Retain allowed evidence too, and attach even an empty batch on failure.
        if (
            diagnostics.length ||
            failed ||
            testInfo.status !== testInfo.expectedStatus
        ) {
            await testInfo.attach('browser-network-console-diagnostics', {
                body: JSON.stringify(
                    {
                        unexpected: errors,
                        allowlisted: diagnostics.filter(
                            (entry) => !errors.includes(entry)
                        ),
                    },
                    null,
                    2
                ),
                contentType: 'application/json',
            })
        }
        if (errors.length && !failed) {
            throw new Error(
                `Unexpected browser/network diagnostics:\n${JSON.stringify(errors, null, 2)}`
            )
        }
    }
    try {
        await run()
    } catch (error) {
        failed = true
        throw error
    } finally {
        page.off('console', onConsole)
        page.off('pageerror', onPageError)
        page.off('requestfailed', onRequestFailed)
        page.off('response', onResponse)
        await report()
    }
}
