import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
    DHIS2_PREFIX,
    proxyDhis2Request,
    resolveDocsBackend,
} from './server/dhis2-proxy.mjs'

/**
 * Production docs server.
 *
 * `vite build` emits a fully static bundle, so it cannot contain the
 * development proxy. This small Node server is the documented production
 * setup: it serves `dist/` and forwards the same-origin `/dhis2` prefix to
 * the configured backend. A standard reverse proxy (nginx, Caddy) can serve
 * the same role — see apps/docs/README.md for an equivalent configuration.
 */
const distDir = fileURLToPath(new URL('./dist', import.meta.url))

const port = Number(process.env.DOCS_PORT ?? 3002)

const backend = resolveDocsBackend(process.env.DOCS_DHIS2_URL)

const MIME_TYPES = {
    '.css': 'text/css; charset=utf-8',
    '.gif': 'image/gif',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain; charset=utf-8',
    '.webp': 'image/webp',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
}

const isPathInside = (root, candidate) =>
    candidate === root || candidate.startsWith(`${root}/`)

const resolveStaticFile = (pathname) => {
    const candidate = normalize(join(distDir, pathname))

    if (!isPathInside(distDir, candidate)) {
        return undefined
    }

    if (existsSync(candidate) && statSync(candidate).isFile()) {
        return candidate
    }

    return undefined
}

const serveFile = (res, filePath) => {
    const type = MIME_TYPES[extname(filePath)] ?? 'application/octet-stream'
    const immutable = filePath.includes(`${normalize('/assets/')}`)

    res.writeHead(200, {
        'Content-Type': type,
        'Cache-Control': immutable
            ? 'public, max-age=31536000, immutable'
            : 'no-cache',
    })
    createReadStream(filePath).pipe(res)
}

const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`)

    if (
        url.pathname === DHIS2_PREFIX ||
        url.pathname.startsWith(`${DHIS2_PREFIX}/`)
    ) {
        proxyDhis2Request(req, res, backend)

        return
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405)
        res.end()

        return
    }

    const file =
        resolveStaticFile(url.pathname) ?? resolveStaticFile('/index.html')

    if (!file) {
        res.writeHead(404)
        res.end('Documentation build not found. Run `pnpm build` first.')

        return
    }

    serveFile(res, file)
})

server.listen(port, () => {
    console.log(`DHIS2 Blocks docs on http://localhost:${port}`)
    console.log(`Proxying ${DHIS2_PREFIX}/* to ${backend}`)
})
