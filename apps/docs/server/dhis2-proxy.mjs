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

/**
 * Optional demo credentials. When `DOCS_DHIS2_USERNAME` and
 * `DOCS_DHIS2_PASSWORD` are set, every proxied request is authenticated
 * upstream as that account — live previews render data with no sign-in
 * flow. Demo and play instances all publish `admin`/`district`, so the
 * docs site can ship the same defaults. When unset, requests pass through
 * anonymously and the adapter shows its sign-in dialog.
 */
export const resolveDocsAuth = (env = process.env) => {
    const username = env.DOCS_DHIS2_USERNAME?.trim()
    const password = env.DOCS_DHIS2_PASSWORD

    if (!username || !password) {
        return null
    }

    return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
}

/**
 * Apply injected credentials to a forwarded header map. The injected auth
 * wins over anything the browser sent so every visitor sees the same
 * authenticated preview.
 */
const applyDocsAuth = (headers, auth) => {
    if (!auth) {
        return
    }

    delete headers.cookie
    delete headers.authorization
    headers.authorization = auth
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

    const stripBasePath = (path) =>
        basePath && path.startsWith(`${basePath}/`)
            ? path.slice(basePath.length)
            : path === basePath
              ? '/'
              : path

    if (location.startsWith('/')) {
        const path = stripBasePath(location)

        return path.startsWith(DHIS2_PREFIX) ? path : `${DHIS2_PREFIX}${path}`
    }

    try {
        const resolved = new URL(location)

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

/** Vite `server.proxy`/`preview.proxy` entry for the same-origin prefix. */
export const createDhis2ViteProxy = (target, env = process.env) => {
    const docsAuth = resolveDocsAuth(env)

    // The context key is prefix-matched by Vite, so `/dhis2` alone would also
    // capture `/dhis2-symbol.svg` and friends. The `^` regex form scopes the
    // proxy to the prefix itself and paths below it — matching server.mjs.
    return {
        [`^${DHIS2_PREFIX}(/|$)`]: {
            target,
            changeOrigin: true,
            secure: false,
            rewrite: (path) => stripDhis2Prefix(path),
            configure: (proxy) => {
                // DHIS2's CORS layer answers requests carrying a foreign Origin
                // with an empty 200 (and no session cookie). Requests through this
                // prefix are backend-native, so Origin/Referer are rewritten to
                // the backend's own origin — never arbitrary third-party origins.
                proxy.on('proxyReq', (proxyReq) => {
                    const backend = new URL(target)

                    proxyReq.setHeader('origin', backend.origin)
                    proxyReq.setHeader('referer', `${backend.origin}/`)

                    if (docsAuth) {
                        proxyReq.removeHeader('cookie')
                        proxyReq.removeHeader('authorization')
                        proxyReq.setHeader('authorization', docsAuth)
                    }
                })

                proxy.on('proxyRes', (proxyRes) => {
                    const location = proxyRes.headers.location

                    if (location) {
                        proxyRes.headers.location = rewriteLocationHeader(
                            location,
                            target
                        )
                    }

                    const cookies = rewriteSetCookieHeaders(
                        proxyRes.headers['set-cookie']
                    )

                    if (cookies) {
                        proxyRes.headers['set-cookie'] = cookies
                    }
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
    const backend = new URL(target)
    const transport = backend.protocol === 'https:' ? https : http

    const headers = {
        ...req.headers,
        host: backend.host,
        origin: backend.origin,
        referer: `${backend.origin}/`,
    }

    for (const header of HOP_BY_HOP_HEADERS) {
        delete headers[header]
    }

    applyDocsAuth(headers, resolveDocsAuth(env))

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

            if (responseHeaders.location) {
                responseHeaders.location = rewriteLocationHeader(
                    responseHeaders.location,
                    target
                )
            }

            const cookies = rewriteSetCookieHeaders(
                responseHeaders['set-cookie']
            )

            if (cookies) {
                responseHeaders['set-cookie'] = cookies
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
