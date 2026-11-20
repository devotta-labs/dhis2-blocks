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

    // WARNING: Forwarded host headers make DHIS2 misidentify its origin and break CORS.
    for (const header of Object.keys(req.headers)) {
        if (header === 'forwarded' || header.startsWith('x-forwarded-')) {
            delete req.headers[header]
        }
    }

    return new Promise((resolve, reject) => {
        res.once('finish', resolve)
        res.once('close', resolve)
        res.once('error', reject)
        proxyDhis2Request(req, res, backend)
    })
}
