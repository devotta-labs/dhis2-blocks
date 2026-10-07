import http from 'node:http'
import https from 'node:https'

/**
 * Shared same-origin DHIS2 proxy helpers.
 *
 * The docs application only ever talks to DHIS2 through the `/dhis2` path
 * prefix on its own origin. Both the Vite development/preview proxy and the
 * production file server in `server.mjs` use these helpers so authentication,
 * cookies, redirects, and sessions behave identically everywhere.
 */
export const DHIS2_PREFIX = '/dhis2'

const DOCS_DEFAULT_BACKEND = 'http://127.0.0.1:58080'

export const resolveDocsBackend = (value) => {
    const candidate = (value ?? '').trim() || DOCS_DEFAULT_BACKEND

    try {
        return new URL(candidate).toString().replace(/\/$/, '')
    } catch {
        throw new Error(`Invalid DOCS_DHIS2_URL: ${candidate}`)
    }
}

export const stripDhis2Prefix = (url) => {
    if (url === DHIS2_PREFIX) {
        return '/'
    }

    if (url.startsWith(`${DHIS2_PREFIX}/`)) {
        return url.slice(DHIS2_PREFIX.length)
    }

    return url
}

/**
 * Point redirect responses back at the same-origin prefix. DHIS2 answers some
 * requests (legacy login, expired sessions) with `Location` headers that are
 * relative to its own root or absolute on its own origin.
 */
export const rewriteLocationHeader = (location, target) => {
    if (!location) {
        return location
    }

    const backend = new URL(target)

    if (location.startsWith('/')) {
        return location.startsWith(DHIS2_PREFIX)
            ? location
            : `${DHIS2_PREFIX}${location}`
    }

    try {
        const resolved = new URL(location)

        if (resolved.origin === backend.origin) {
            return `${DHIS2_PREFIX}${resolved.pathname}${resolved.search}${resolved.hash}`
        }
    } catch {
        return location
    }

    return location
}

/** Vite `server.proxy`/`preview.proxy` entry for the same-origin prefix. */
export const createDhis2ViteProxy = (target) => ({
    [DHIS2_PREFIX]: {
        target,
        changeOrigin: true,
        secure: false,
        rewrite: (path) => stripDhis2Prefix(path),
        configure: (proxy) => {
            proxy.on('proxyRes', (proxyRes) => {
                const location = proxyRes.headers.location

                if (location) {
                    proxyRes.headers.location = rewriteLocationHeader(
                        location,
                        target
                    )
                }
            })
        },
    },
})

const HOP_BY_HOP_HEADERS = new Set([
    'connection',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade',
])

/**
 * Forward one Node request/response pair to the DHIS2 backend. Streams bodies
 * in both directions, forwards cookies and authorization headers, and rewrites
 * redirect locations back onto the same-origin prefix.
 */
export const proxyDhis2Request = (req, res, target) => {
    const backend = new URL(target)
    const transport = backend.protocol === 'https:' ? https : http

    const headers = { ...req.headers, host: backend.host }

    for (const header of HOP_BY_HOP_HEADERS) {
        delete headers[header]
    }

    const upstream = transport.request(
        {
            hostname: backend.hostname,
            port: backend.port || (backend.protocol === 'https:' ? 443 : 80),
            path: `${stripDhis2Prefix(req.url)}`,
            method: req.method,
            headers,
        },
        (upstreamRes) => {
            const responseHeaders = { ...upstreamRes.headers }

            for (const header of HOP_BY_HOP_HEADERS) {
                delete responseHeaders[header]
            }

            if (responseHeaders.location) {
                responseHeaders.location = rewriteLocationHeader(
                    responseHeaders.location,
                    target
                )
            }

            res.writeHead(
                upstreamRes.statusCode ?? 502,
                upstreamRes.statusMessage,
                responseHeaders
            )
            upstreamRes.pipe(res)
        }
    )

    upstream.on('error', (error) => {
        if (!res.headersSent) {
            res.writeHead(502, { 'Content-Type': 'application/json' })
        }

        res.end(
            JSON.stringify({
                message: `DHIS2 backend unavailable at ${target}`,
                error: error.message,
            })
        )
    })

    req.pipe(upstream)
}
