const defaultUpstream = 'https://play.im.dhis2.org/dev'
const defaultUsername = 'admin'
const defaultPassword = 'district'

const forbiddenSegment = /[\\/\p{Cc}]/u

export interface Dhis2ProxyConfig {
    upstream: URL
    authorization: string
}

export function normalizeApiPath(segments: readonly string[]) {
    if (segments.length < 2 || segments[0] !== 'api') {
        throw new Error('Only DHIS2 API paths can be proxied.')
    }

    return segments
        .map((segment) => {
            if (
                segment.length === 0 ||
                segment === '.' ||
                segment === '..' ||
                forbiddenSegment.test(segment)
            ) {
                throw new Error('The DHIS2 API path is invalid.')
            }

            return encodeURIComponent(segment)
        })
        .join('/')
}

export function normalizeUpstream(value: string) {
    const upstream = new URL(value)

    if (!['http:', 'https:'].includes(upstream.protocol)) {
        throw new Error('The configured DHIS2 server must use HTTP or HTTPS.')
    }

    upstream.username = ''
    upstream.password = ''
    upstream.search = ''
    upstream.hash = ''
    upstream.pathname = upstream.pathname.replace(/\/+$/, '')
    return upstream
}

export function buildUpstreamUrl(
    upstream: URL,
    apiPath: string,
    search: string
) {
    const base = new URL(upstream)
    base.pathname = `${base.pathname.replace(/\/+$/, '')}/${apiPath}`
    base.search = search
    return base
}

export function getDhis2ProxyConfig(): Dhis2ProxyConfig {
    const upstream = normalizeUpstream(
        process.env.DHIS2_BASE_URL?.trim() || defaultUpstream
    )
    const username = process.env.DHIS2_USERNAME?.trim() || defaultUsername
    const password = process.env.DHIS2_PASSWORD ?? defaultPassword
    const authorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`

    return { upstream, authorization }
}
