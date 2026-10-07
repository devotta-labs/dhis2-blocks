import { describe, expect, it } from 'vitest'
import {
    isCrossSiteWrite,
    resolveDocsAuth,
    resolveDocsBackend,
    resolveUpstreamPath,
    rewriteLocationHeader,
    rewriteSetCookieHeaders,
    stripDhis2Prefix,
} from './dhis2-proxy.mjs'

describe('stripDhis2Prefix', () => {
    it('removes the prefix while preserving the remaining path and query', () => {
        expect(stripDhis2Prefix('/dhis2/api/42/programs?paging=false')).toBe(
            '/api/42/programs?paging=false'
        )
    })

    it('maps the bare prefix to the backend root', () => {
        expect(stripDhis2Prefix('/dhis2')).toBe('/')
    })

    it('leaves non-prefixed paths untouched', () => {
        expect(stripDhis2Prefix('/api/ping')).toBe('/api/ping')
    })
})

describe('rewriteLocationHeader', () => {
    const target = 'http://127.0.0.1:58080'

    it('re-roots backend-relative redirects onto the prefix', () => {
        expect(
            rewriteLocationHeader(
                '/dhis-web-commons/security/login.action',
                target
            )
        ).toBe('/dhis2/dhis-web-commons/security/login.action')
    })

    it('keeps already-prefixed locations unchanged', () => {
        expect(rewriteLocationHeader('/dhis2/api/42/me', target)).toBe(
            '/dhis2/api/42/me'
        )
    })

    it('rewrites absolute redirects that point at the backend origin', () => {
        expect(
            rewriteLocationHeader(`${target}/api/42/me?fields=id`, target)
        ).toBe('/dhis2/api/42/me?fields=id')
    })

    it('leaves unrelated absolute locations unchanged', () => {
        expect(rewriteLocationHeader('https://example.com/x', target)).toBe(
            'https://example.com/x'
        )
    })

    it('strips the backend context path from relative redirects', () => {
        expect(
            rewriteLocationHeader(
                '/dev/login/',
                'https://play.im.dhis2.org/dev'
            )
        ).toBe('/dhis2/login/')
    })

    it('strips the backend context path from absolute redirects', () => {
        expect(
            rewriteLocationHeader(
                'https://play.im.dhis2.org/dev/api/programs?paging=false',
                'https://play.im.dhis2.org/dev'
            )
        ).toBe('/dhis2/api/programs?paging=false')
    })

    it('does not strip partial context path matches', () => {
        expect(
            rewriteLocationHeader(
                '/dev-fork/api/ping',
                'https://play.im.dhis2.org/dev'
            )
        ).toBe('/dhis2/dev-fork/api/ping')
    })
})

describe('resolveUpstreamPath', () => {
    it('strips the prefix for root deployments', () => {
        expect(
            resolveUpstreamPath(
                '/dhis2/api/42/me?fields=id',
                'http://127.0.0.1:58080'
            )
        ).toBe('/api/42/me?fields=id')
    })

    it('re-attaches the backend context path', () => {
        expect(
            resolveUpstreamPath(
                '/dhis2/api/me',
                'https://play.im.dhis2.org/dev'
            )
        ).toBe('/dev/api/me')
    })

    it('maps the bare prefix onto the context root', () => {
        expect(
            resolveUpstreamPath('/dhis2', 'https://play.im.dhis2.org/dev')
        ).toBe('/dev/')
    })
})

describe('rewriteSetCookieHeaders', () => {
    it('re-roots the cookie path so /dhis2 requests send it', () => {
        expect(
            rewriteSetCookieHeaders([
                'JSESSIONID=ABC; Path=/dev; Secure; HttpOnly; SameSite=lax',
            ])
        ).toEqual(['JSESSIONID=ABC; Path=/; Secure; HttpOnly; SameSite=lax'])
    })

    it('adds a root path when none is declared', () => {
        expect(rewriteSetCookieHeaders(['TOKEN=1; HttpOnly'])).toEqual([
            'TOKEN=1; HttpOnly; Path=/',
        ])
    })

    it('leaves a missing header untouched', () => {
        expect(rewriteSetCookieHeaders(undefined)).toBeUndefined()
    })
})

describe('resolveDocsBackend', () => {
    it('falls back to the pinned local default', () => {
        expect(resolveDocsBackend(undefined)).toBe('http://127.0.0.1:58080')
        expect(resolveDocsBackend('  ')).toBe('http://127.0.0.1:58080')
    })

    it('normalizes a trailing slash', () => {
        expect(resolveDocsBackend('https://play.im.dhis2.org/dev/')).toBe(
            'https://play.im.dhis2.org/dev'
        )
    })

    it('rejects values that are not URLs', () => {
        expect(() => resolveDocsBackend('not-a-url')).toThrow(
            /Invalid DOCS_DHIS2_URL/
        )
    })
})

describe('resolveDocsAuth', () => {
    it('returns a Basic header for configured credentials', () => {
        expect(
            resolveDocsAuth({
                DOCS_DHIS2_USERNAME: 'admin',
                DOCS_DHIS2_PASSWORD: 'district',
            })
        ).toBe(`Basic ${Buffer.from('admin:district').toString('base64')}`)
    })

    it('passes requests anonymously when either value is missing', () => {
        expect(resolveDocsAuth({})).toBeNull()
        expect(resolveDocsAuth({ DOCS_DHIS2_USERNAME: 'admin' })).toBeNull()
        expect(resolveDocsAuth({ DOCS_DHIS2_PASSWORD: 'district' })).toBeNull()
    })
})

describe('isCrossSiteWrite', () => {
    it('rejects mutating verbs marked cross-site', () => {
        expect(
            isCrossSiteWrite('POST', { 'sec-fetch-site': 'cross-site' })
        ).toBe(true)
        expect(
            isCrossSiteWrite('DELETE', { 'sec-fetch-site': 'cross-site' })
        ).toBe(true)
    })

    it('allows reads, same-site writes, and headerless requests', () => {
        expect(
            isCrossSiteWrite('GET', { 'sec-fetch-site': 'cross-site' })
        ).toBe(false)
        expect(
            isCrossSiteWrite('POST', { 'sec-fetch-site': 'same-origin' })
        ).toBe(false)
        expect(
            isCrossSiteWrite('POST', { 'sec-fetch-site': 'same-site' })
        ).toBe(false)
        expect(isCrossSiteWrite('POST', {})).toBe(false)
    })
})
