import {
    proxyDhis2Request,
    resolveDocsBackend,
} from '../apps/docs/server/dhis2-proxy.mjs'

export const config = { api: { bodyParser: false } }

export default function handler(req, res) {
    if (!/^\/dhis2(?:\/|\?|$)/.test(req.url ?? '')) {
        res.writeHead(404)
        res.end()

        return
    }

    const backend = resolveDocsBackend(process.env.DOCS_DHIS2_URL)

    // Vercel's forwarding headers describe the docs host. DHIS2 uses them
    // to determine its own origin, which would break the proxy's CORS handling.
    for (const header of Object.keys(req.headers)) {
        if (header === 'forwarded' || header.startsWith('x-forwarded-')) {
            delete req.headers[header]
        }
    }

    // Keep the function alive until the streamed upstream response completes.
    return new Promise((resolve, reject) => {
        res.once('finish', resolve)
        res.once('close', resolve)
        res.once('error', reject)
        proxyDhis2Request(req, res, backend)
    })
}
