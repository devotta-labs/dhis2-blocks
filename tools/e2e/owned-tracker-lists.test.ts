import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { test } from 'node:test'
import { chromium } from '@playwright/test'
import { z } from 'zod'
import { withOwnedTrackerLists } from '../../e2e/fixtures/owned-tracker-lists.ts'

for (const endpoint of [
    '/api/trackedEntityInstanceFilters',
    '/dhis2/api/trackedEntityInstanceFilters',
    '/dhis2/api/42/trackedEntityInstanceFilters',
    '/context/dhis2/api/43/trackedEntityInstanceFilters',
]) {
    test(`${endpoint}: failed create, save and reload assertions clean only lists created in their fixture lifetime`, async () => {
        const lists = new Set(['preexisting'])
        const deleted: string[] = []
        let sequence = 0
        const server = createServer((request, response) => {
            const id = request.url?.split('/').at(-1) ?? ''
            response.setHeader('Content-Type', 'application/json')
            if (request.method === 'POST') {
                const uid = `created-${++sequence}`
                lists.add(uid)
                response.end(JSON.stringify({ response: { uid } }))
            } else if (request.method === 'DELETE') {
                deleted.push(request.url ?? '')
                response.statusCode = lists.delete(id) ? 204 : 404
                response.end()
            } else if (request.method === 'PUT') response.end('{}')
            else {
                response.setHeader('Content-Type', 'text/html')
                response.end('<body>Disposable fixture server</body>')
            }
        })
        await new Promise<void>((resolve) =>
            server.listen(0, '127.0.0.1', resolve)
        )
        const address = z.object({ port: z.number() }).parse(server.address())
        const browser = await chromium.launch()
        try {
            const page = await browser.newPage()
            await page.goto(`http://127.0.0.1:${address.port}`)
            for (const phase of ['create', 'save', 'reload']) {
                await assert.rejects(
                    withOwnedTrackerLists(page, async () => {
                        const id = await page.evaluate(async (endpoint) => {
                            const response = await fetch(
                                `${endpoint}?fields=id`,
                                { method: 'POST' }
                            )
                            return (await response.json()).response.uid
                        }, endpoint)
                        if (phase !== 'create')
                            await page.request.put(
                                new URL(`${endpoint}/${id}`, page.url()).href
                            )
                        if (phase === 'reload') await page.reload()
                        throw new Error(`assertion after ${phase}`)
                    }),
                    new RegExp(`assertion after ${phase}`)
                )
                assert.deepEqual([...lists], ['preexisting'])
            }
            assert.deepEqual(
                deleted,
                [1, 2, 3].map((id) => `${endpoint}/created-${id}`)
            )
        } finally {
            await browser.close()
            await new Promise<void>((resolve, reject) =>
                server.close((error) => (error ? reject(error) : resolve()))
            )
        }
    })

    for (const outcome of ['created', 'failed', 'navigated'] as const) {
        test(`${endpoint}: ${outcome} create preserves ownership through assertion failure`, async () => {
            const lists = new Set(['preexisting'])
            const deleted: string[] = []
            let release = () => {}
            const gate = new Promise<void>((resolve) => {
                release = resolve
            })
            let started = () => {}
            const pending = new Promise<void>((resolve) => {
                started = resolve
            })
            const server = createServer((request, response) => {
                response.setHeader('Content-Type', 'application/json')
                if (request.method === 'POST') {
                    void gate.then(() => {
                        if (outcome === 'failed') {
                            response.destroy()
                            return
                        }
                        lists.add('late-owned-list')
                        response.end(
                            JSON.stringify({
                                response: { uid: 'late-owned-list' },
                            })
                        )
                    })
                    started()
                } else if (request.method === 'DELETE') {
                    const id = request.url?.split('/').at(-1) ?? ''
                    deleted.push(request.url ?? '')
                    response.statusCode = lists.delete(id) ? 204 : 404
                    response.end()
                } else {
                    response.setHeader('Content-Type', 'text/html')
                    response.end('<body>Disposable gated fixture server</body>')
                }
            })
            await new Promise<void>((resolve) =>
                server.listen(0, '127.0.0.1', resolve)
            )
            const address = z
                .object({ port: z.number() })
                .parse(server.address())
            const browser = await chromium.launch()
            try {
                const page = await browser.newPage()
                await page.goto(`http://127.0.0.1:${address.port}`)
                let failed = () => {}
                const runFailed = new Promise<void>((resolve) => {
                    failed = resolve
                })
                let settled = Promise.resolve()
                if (outcome === 'created')
                    settled = page
                        .waitForResponse(
                            (response) => response.request().method() === 'POST'
                        )
                        .then(async (response) => {
                            await response.finished()
                        })
                if (outcome === 'failed')
                    settled = page.waitForEvent('requestfailed').then(() => {})
                if (outcome === 'navigated')
                    settled = page.waitForEvent('framenavigated').then(() => {})
                const fixture = assert.rejects(
                    withOwnedTrackerLists(page, async () => {
                        await page.evaluate(
                            ({ endpoint, outcome }) => {
                                void fetch(`${endpoint}?fields=id`, {
                                    method: 'POST',
                                })
                                    .then(async (response) => {
                                        await response.json()
                                        if (outcome === 'navigated')
                                            location.reload()
                                    })
                                    .catch(() => undefined)
                            },
                            { endpoint, outcome }
                        )
                        await pending
                        if (outcome === 'navigated') {
                            release()
                            await settled
                        }
                        failed()
                        throw new Error('assertion before create response')
                    }),
                    /assertion before create response/
                )
                await runFailed
                release()
                await settled
                await fixture
                assert.deepEqual([...lists], ['preexisting'])
                assert.deepEqual(
                    deleted,
                    outcome === 'failed' ? [] : [`${endpoint}/late-owned-list`]
                )
            } finally {
                release()
                await browser.close()
                await new Promise<void>((resolve, reject) =>
                    server.close((error) => (error ? reject(error) : resolve()))
                )
            }
        })
    }
}

for (const result of [
    'created',
    'rejected',
    'malformed',
    'delete-failed',
] as const) {
    test(`${result}: preserves wire responses and other route handlers`, async () => {
        const endpoint = '/dhis2/api/42/trackedEntityInstanceFilters'
        const status = result === 'rejected' ? 409 : 201
        const body =
            result === 'malformed'
                ? '{not JSON'
                : JSON.stringify({ response: { uid: 'owned-list' } })
        const deleted: string[] = []
        const posts: string[] = []
        const server = createServer((request, response) => {
            if (request.method === 'POST') {
                request.setEncoding('utf8')
                let posted = ''
                request.on('data', (chunk) => {
                    posted += chunk
                })
                request.on('end', () => {
                    posts.push(posted)
                    response.writeHead(status, {
                        'Content-Type': 'application/json',
                        'X-Fixture-Response': 'unchanged',
                    })
                    response.end(body)
                })
            } else if (request.method === 'DELETE') {
                deleted.push(request.url ?? '')
                response.statusCode = result === 'delete-failed' ? 500 : 204
                response.end()
            } else {
                response.setHeader('Content-Type', 'text/html')
                response.end('<body>Disposable routing fixture</body>')
            }
        })
        await new Promise<void>((resolve) =>
            server.listen(0, '127.0.0.1', resolve)
        )
        const address = z.object({ port: z.number() }).parse(server.address())
        const browser = await chromium.launch()
        try {
            const page = await browser.newPage()
            await page.goto(`http://127.0.0.1:${address.port}`)
            const fallbackMethods: string[] = []
            await page.route(`**${endpoint}`, async (route) => {
                fallbackMethods.push(route.request().method())
                await route.fulfill({ status: 202, body: 'existing route' })
            })
            await page.route('**/unrelated', (route) =>
                route.fulfill({ body: 'unrelated route' })
            )
            const fixture = withOwnedTrackerLists(page, async () => {
                const actual = await page.evaluate(async (endpoint) => {
                    const response = await fetch(endpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: '{"name":"owned"}',
                    })
                    return {
                        status: response.status,
                        body: await response.text(),
                        header: response.headers.get('X-Fixture-Response'),
                        fallback: await (await fetch(endpoint)).text(),
                        unrelated: await (await fetch('/unrelated')).text(),
                    }
                }, endpoint)
                assert.deepEqual(actual, {
                    status,
                    body,
                    header: 'unchanged',
                    fallback: 'existing route',
                    unrelated: 'unrelated route',
                })
            })
            if (result === 'malformed' || result === 'delete-failed') {
                await assert.rejects(fixture, (error: Error) => {
                    assert.ok(error instanceof AggregateError)
                    assert.equal(error.errors.length, 1)
                    assert.match(
                        String(error.errors[0]),
                        result === 'malformed'
                            ? /JSON/
                            : /cleanup failed: HTTP 500/
                    )
                    return true
                })
            } else await fixture
            assert.deepEqual(posts, ['{"name":"owned"}'])
            assert.deepEqual(
                deleted,
                result === 'created' || result === 'delete-failed'
                    ? [`${endpoint}/owned-list`]
                    : []
            )
            const after = await page.evaluate(async (endpoint) => {
                const response = await fetch(endpoint, { method: 'POST' })
                return { status: response.status, body: await response.text() }
            }, endpoint)
            assert.deepEqual(after, { status: 202, body: 'existing route' })
            assert.deepEqual(fallbackMethods, ['GET', 'POST'])
        } finally {
            await browser.close()
            await new Promise<void>((resolve, reject) =>
                server.close((error) => (error ? reject(error) : resolve()))
            )
        }
    })
}
