import { urlPath, type BrowserDiagnostic } from './browser-diagnostics.ts'

const isKnownBenignDiagnostic = (
    diagnostic: BrowserDiagnostic,
    allowOfflineRequestFailures: boolean
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

type WebDiagnosticOptions = {
    allowOfflineRequestFailures: boolean
    allowSharingTypeWarning: boolean
}

const isSharingTypeWarning = (diagnostic: BrowserDiagnostic) =>
    diagnostic.kind === 'console' &&
    /Invalid prop `type` of value `trackedEntityInstanceFilter` supplied to `(SharingDialog|TabbedContent)`, expected one of /.test(
        diagnostic.message
    )

export const unexpectedWebDiagnostics = (
    diagnostics: BrowserDiagnostic[],
    options: WebDiagnosticOptions
) =>
    diagnostics.filter(
        (diagnostic) =>
            !(
                options.allowSharingTypeWarning &&
                isSharingTypeWarning(diagnostic)
            ) &&
            !isKnownBenignDiagnostic(
                diagnostic,
                options.allowOfflineRequestFailures
            )
    )
