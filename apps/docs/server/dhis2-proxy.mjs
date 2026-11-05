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

// Vite matches the raw request URL, including a query on the bare prefix.
const DHIS2_ROUTE_PATTERN = `^${DHIS2_PREFIX}(?:/|\\?|$)`
const DHIS2_ROUTE = new RegExp(DHIS2_ROUTE_PATTERN)

export const isDhis2Path = (url) => DHIS2_ROUTE.test(url ?? '')

const DOCS_DEFAULT_BACKEND = 'http://127.0.0.1:58080'

const DOCS_DEMO_USERNAME = 'admin'

const DOCS_DEMO_PASSWORD = 'district'

/**
 * Injected upstream credentials. Every DHIS2 demo and play instance
 * publishes `admin`/`district`, so the docs proxy authenticates as that
 * account out of the box — live previews always render an active session
 * with no sign-in flow. `DOCS_DHIS2_USERNAME`/`DOCS_DHIS2_PASSWORD`
 * override the account; `DOCS_DHIS2_ANONYMOUS=1` disables injection so
 * requests pass through anonymously and the adapter shows its dialog.
 */
export const resolveDocsAuth = (env = process.env) => {
    if (['1', 'true', 'yes'].includes(env.DOCS_DHIS2_ANONYMOUS ?? '')) {
        return null
    }

    const username = env.DOCS_DHIS2_USERNAME?.trim() || DOCS_DEMO_USERNAME
    const password = env.DOCS_DHIS2_PASSWORD || DOCS_DEMO_PASSWORD

    return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
}

export const resolveDocsCookies = (cookie) =>
    cookie
        ?.split(';')
        .map((part) => part.trim())
        .filter((part) => /^(JSESSIONID|XSRF-TOKEN)=/.test(part))
        .join('; ') || undefined

const docsRequestHeaders = (headers, target, auth) => {
    const cookie = resolveDocsCookies(headers.cookie)
    const backend = new URL(target)

    // DHIS2's CORS layer can return an empty 200 for a foreign Origin.
    // This prefix is backend-native, never an arbitrary third-party origin.
    return {
        origin: backend.origin,
        referer: `${backend.origin}/`,
        authorization: auth ?? headers.authorization,
        cookie: auth ? undefined : cookie,
    }
}

/**
 * CSRF guard for mutating verbs. The proxy rewrites Origin and injects
 * credentials (or forwards a session cookie), so a cross-site form POST
 * would execute as the authenticated user. Browsers mark such requests
 * `Sec-Fetch-Site: cross-site`; reject those outright. Requests without
 * the header (older browsers, curl, server-to-server) pass through.
 */
export const isCrossSiteWrite = (method, headers = {}) => {
    if (!method || ['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())) {
        return false
    }

    return headers['sec-fetch-site'] === 'cross-site'
}

/**
 * Connect middleware enforcing the same guard inside Vite dev/preview —
 * registered before the proxy so cross-site writes never leave the docs
 * origin. Mirrors the check inside `proxyDhis2Request` for `server.mjs`.
 */
export const dhis2CsrfGuard = (req, res, next) => {
    if (isDhis2Path(req.url) && isCrossSiteWrite(req.method, req.headers)) {
        res.statusCode = 403
        res.end('Cross-site writes are not allowed')

        return
    }

    next()
}

export const resolveDocsBackend = (value) => {
    const candidate = (value ?? '').trim() || DOCS_DEFAULT_BACKEND

    try {
        return new URL(candidate).toString().replace(/\/$/, '')
    } catch {
        throw new Error(`Invalid DOCS_DHIS2_URL: ${candidate}`)
    }
}

export const stripDhis2Prefix = (url) => {
    if (!isDhis2Path(url)) return url

    const suffix = url.slice(DHIS2_PREFIX.length)
    return suffix.startsWith('/') ? suffix : `/${suffix}`
}

/**
 * Point redirect responses back at the same-origin prefix. DHIS2 answers some
 * requests (legacy login, expired sessions) with `Location` headers that are
 * relative to its own root or absolute on its own origin. Backends deployed
 * under a context path (e.g. `https://host/dev`) include it in the location,
 * so the backend path prefix is stripped before adding the local prefix.
 */
export const rewriteLocationHeader = (location, target) => {
    if (!location) {
        return location
    }

    const backend = new URL(target)
    const basePath = backend.pathname.replace(/\/$/, '')

    const stripBasePath = (path) => {
        if (basePath && path.startsWith(`${basePath}/`)) {
            return path.slice(basePath.length)
        }
        if (
            basePath &&
            (path.startsWith(`${basePath}?`) || path.startsWith(`${basePath}#`))
        ) {
            return `/${path.slice(basePath.length)}`
        }
        return path === basePath ? '/' : path
    }

    if (location.startsWith('/') && !location.startsWith('//')) {
        const path = stripBasePath(location)

        return isDhis2Path(path.split('#')[0]) ? path : `${DHIS2_PREFIX}${path}`
    }

    try {
        const resolved = location.startsWith('//')
            ? new URL(location, backend)
            : new URL(location)

        if (resolved.origin === backend.origin) {
            return `${DHIS2_PREFIX}${stripBasePath(resolved.pathname)}${resolved.search}${resolved.hash}`
        }
    } catch {
        return location
    }

    return location
}

/**
 * Session cookies are scoped to the backend's own path (e.g. `Path=/dev`).
 * Browsers would never send them on `/dhis2` requests, so every Set-Cookie
 * path is rewritten to `/` on this origin.
 */
export const rewriteSetCookieHeaders = (cookies) =>
    cookies?.map((cookie) =>
        /;\s*path=/i.test(cookie)
            ? cookie.replace(/;\s*path=[^;]*/i, '; Path=/')
            : `${cookie}; Path=/`
    )

const applyDocsResponseHeaders = (headers, target) => {
    if (headers.location) {
        headers.location = rewriteLocationHeader(headers.location, target)
    }

    const cookies = rewriteSetCookieHeaders(headers['set-cookie'])
    if (cookies) headers['set-cookie'] = cookies
}

/** Vite `server.proxy`/`preview.proxy` entry for the same-origin prefix. */
export const createDhis2ViteProxy = (target, env = process.env) => {
    const docsAuth = resolveDocsAuth(env)

    // Vite prefix-matches plain keys; use the shared route regex so assets
    // such as `/dhis2-symbol.svg` stay local in every serving mode.
    return {
        [DHIS2_ROUTE_PATTERN]: {
            target,
            changeOrigin: true,
            secure: false,
            rewrite: (path) => stripDhis2Prefix(path),
            configure: (proxy) => {
                proxy.on('proxyReq', (proxyReq, req) => {
                    const headers = docsRequestHeaders(
                        req.headers,
                        target,
                        docsAuth
                    )
                    for (const [name, value] of Object.entries(headers)) {
                        if (value === undefined) proxyReq.removeHeader(name)
                        else proxyReq.setHeader(name, value)
                    }
                })

                proxy.on('proxyRes', (proxyRes) => {
                    applyDocsResponseHeaders(proxyRes.headers, target)
                })
            },
        },
    }
}

/**
 * Compute the upstream request path: the local `/dhis2` prefix comes off and
 * the backend's own context path (e.g. `/dev` in `https://host/dev`) goes on.
 * Without this, production serving against context-path deployments would
 * forward `/api/me` instead of `/dev/api/me`.
 */
export const resolveUpstreamPath = (url, target) => {
    const basePath = new URL(target).pathname.replace(/\/$/, '')

    return `${basePath}${stripDhis2Prefix(url)}`
}

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
export const proxyDhis2Request = (req, res, target, env = process.env) => {
    if (isCrossSiteWrite(req.method, req.headers)) {
        res.writeHead(403, { 'Content-Type': 'application/json' })
        res.end(
            JSON.stringify({ message: 'Cross-site writes are not allowed' })
        )

        return
    }

    const backend = new URL(target)
    const transport = backend.protocol === 'https:' ? https : http

    const headers = {
        ...req.headers,
        host: backend.host,
        ...docsRequestHeaders(req.headers, target, resolveDocsAuth(env)),
    }

    for (const header of Object.keys(headers)) {
        if (headers[header] === undefined) delete headers[header]
    }
    for (const header of HOP_BY_HOP_HEADERS) {
        delete headers[header]
    }

    const upstream = transport.request(
        {
            hostname: backend.hostname,
            port: backend.port || (backend.protocol === 'https:' ? 443 : 80),
            path: resolveUpstreamPath(req.url, target),
            method: req.method,
            headers,
        },
        (upstreamRes) => {
            const responseHeaders = { ...upstreamRes.headers }

            for (const header of HOP_BY_HOP_HEADERS) {
                delete responseHeaders[header]
            }

            applyDocsResponseHeaders(responseHeaders, target)

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
