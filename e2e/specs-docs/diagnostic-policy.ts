import {
    urlPath,
    type BrowserDiagnostic,
} from '../fixtures/browser-diagnostics.ts'

// Paths the adapter's bootstrap probes before sign-in. The list is shared
// with the AbortError exemption below so both stay in sync.
const bootstrapApiPath =
    /\/api(?:\/\d+)?\/(me|system\/info|loginConfig|userSettings)$/

const isAbortedBootstrapRead = (diagnostic: BrowserDiagnostic) =>
    diagnostic.kind === 'requestfailed' &&
    diagnostic.message === 'net::ERR_ABORTED' &&
    diagnostic.method === 'GET' &&
    bootstrapApiPath.test(urlPath(diagnostic.url) ?? '')

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

export const unexpectedDocsDiagnostics = (diagnostics: BrowserDiagnostic[]) => {
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

        return !isKnownBenignDiagnostic(diagnostic)
    })

    return unexpectedDiagnostics
}
