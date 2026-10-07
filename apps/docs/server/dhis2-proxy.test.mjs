import { describe, expect, it } from 'vitest'
import {
    resolveDocsBackend,
    rewriteLocationHeader,
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
