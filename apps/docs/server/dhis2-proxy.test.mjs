import http from 'node:http'
import { createServer as createViteServer } from 'vite'
import { describe, expect, it } from 'vitest'
import {
    createDhis2ViteProxy,
    isCrossSiteWrite,
    proxyDhis2Request,
    resolveDocsAuth,
    resolveDocsBackend,
    resolveDocsCookies,
    resolveUpstreamPath,
    rewriteLocationHeader,
    rewriteSetCookieHeaders,
    stripDhis2Prefix,
} from './dhis2-proxy.mjs'

const listen = (server) =>
    new Promise((resolve) =>
        server.listen(0, '127.0.0.1', () =>
            resolve(`http://127.0.0.1:${server.address().port}`)
        )
    )

describe.each(['node', 'vite'])('%s proxy header isolation', (transport) => {
    it.each([false, true])(
        'isolates browser credentials with anonymous mode %s',
        async (anonymous) => {
            const backend = http.createServer((req, res) => {
                res.setHeader('content-type', 'application/json')
                res.end(JSON.stringify(req.headers))
            })
            const target = await listen(backend)
            const env = { DOCS_DHIS2_ANONYMOUS: anonymous ? '1' : '0' }
            const proxy =
                transport === 'node'
                    ? http.createServer((req, res) =>
                          proxyDhis2Request(req, res, target, env)
                      )
                    : await createViteServer({
                          configFile: false,
                          logLevel: 'silent',
                          server: {
                              host: '127.0.0.1',
                              port: 0,
                              proxy: createDhis2ViteProxy(target, env),
                          },
                      })

            try {
                let origin

                if (transport === 'node') {
                    origin = await listen(proxy)
                } else {
                    await proxy.listen()
                    origin = `http://127.0.0.1:${proxy.httpServer.address().port}`
                }

                const response = await fetch(`${origin}/dhis2/api/me`, {
                    headers: {
                        cookie: 'docs_session=private; JSESSIONID=dhis-session; analytics=id; XSRF-TOKEN=csrf',
                        authorization: 'Basic browser',
                    },
                })
                const headers = await response.json()

                expect(response.status).toBe(200)
                expect(headers.cookie).toBe(
                    anonymous
                        ? 'JSESSIONID=dhis-session; XSRF-TOKEN=csrf'
                        : undefined
                )
                expect(headers.authorization).toBe(
                    anonymous ? 'Basic browser' : resolveDocsAuth({})
                )
            } finally {
                if (transport === 'node') {
                    await proxy[Symbol.asyncDispose]()
                } else {
                    await proxy.close()
                }

                await backend[Symbol.asyncDispose]()
            }
        }
    )
})

describe('resolveDocsCookies', () => {
    it('forwards only DHIS2 session and CSRF cookies', () => {
        expect(
            resolveDocsCookies(
                'docs_session=private; JSESSIONID=dhis-session; analytics=id; XSRF-TOKEN=csrf'
            )
        ).toBe('JSESSIONID=dhis-session; XSRF-TOKEN=csrf')
    })

    it('drops unrelated cookies rather than sending an empty cookie header', () => {
        expect(resolveDocsCookies('docs_session=private')).toBeUndefined()
        expect(resolveDocsCookies(undefined)).toBeUndefined()
    })
})

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

    it('falls back to the published demo account by default', () => {
        expect(resolveDocsAuth({})).toBe(
            `Basic ${Buffer.from('admin:district').toString('base64')}`
        )
        expect(resolveDocsAuth({ DOCS_DHIS2_USERNAME: 'another' })).toBe(
            `Basic ${Buffer.from('another:district').toString('base64')}`
        )
    })

    it('passes requests anonymously when injection is disabled', () => {
        expect(resolveDocsAuth({ DOCS_DHIS2_ANONYMOUS: '1' })).toBeNull()
        expect(resolveDocsAuth({ DOCS_DHIS2_ANONYMOUS: 'true' })).toBeNull()
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
