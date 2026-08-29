import {
    buildUpstreamUrl,
    getDhis2ProxyConfig,
    normalizeApiPath,
} from '@/lib/dhis2-proxy'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const requestTimeoutMs = 10_000
const responseHeaderNames = [
    'content-disposition',
    'content-language',
    'content-type',
    'etag',
    'last-modified',
] as const

interface ProxyContext {
    params: Promise<{ path: string[] }>
}

async function proxyRequest(request: Request, context: ProxyContext) {
    let apiPath: string

    try {
        const { path } = await context.params
        apiPath = normalizeApiPath(path)
    } catch {
        return new Response('Invalid DHIS2 API path.', { status: 400 })
    }

    const requestUrl = new URL(request.url)
    const { upstream, authorization } = getDhis2ProxyConfig()
    const upstreamUrl = buildUpstreamUrl(upstream, apiPath, requestUrl.search)
    const headers = new Headers({
        accept: request.headers.get('accept') ?? 'application/json',
        authorization,
        'user-agent': 'dhis2-blocks-docs-preview',
    })
    const acceptLanguage = request.headers.get('accept-language')

    if (acceptLanguage) {
        headers.set('accept-language', acceptLanguage)
    }

    try {
        const upstreamResponse = await fetch(upstreamUrl, {
            method: request.method,
            headers,
            cache: 'no-store',
            redirect: 'manual',
            signal: AbortSignal.timeout(requestTimeoutMs),
        })
        const responseHeaders = new Headers({
            'cache-control': 'no-store, max-age=0',
        })

        for (const name of responseHeaderNames) {
            const value = upstreamResponse.headers.get(name)
            if (value) {
                responseHeaders.set(name, value)
            }
        }

        return new Response(
            request.method === 'HEAD' ? null : upstreamResponse.body,
            {
                status: upstreamResponse.status,
                headers: responseHeaders,
            }
        )
    } catch {
        return new Response('The DHIS2 demo server is unavailable.', {
            status: 504,
            headers: { 'cache-control': 'no-store, max-age=0' },
        })
    }
}

export const GET = proxyRequest
export const HEAD = proxyRequest
