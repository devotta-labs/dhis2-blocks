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

    for (const outcome of ['created', 'failed'] as const) {
        test(`${endpoint}: assertion before a ${outcome} POST settles preserves preexisting lists`, async () => {
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
                const settled =
                    outcome === 'created'
                        ? page
                              .waitForResponse(
                                  (response) =>
                                      response.request().method() === 'POST'
                              )
                              .then((response) => response.finished())
                        : page.waitForEvent('requestfailed')
                const fixture = assert.rejects(
                    withOwnedTrackerLists(page, async () => {
                        await page.evaluate((endpoint) => {
                            void fetch(`${endpoint}?fields=id`, {
                                method: 'POST',
                            }).catch(() => undefined)
                        }, endpoint)
                        await pending
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
                    outcome === 'created' ? [`${endpoint}/late-owned-list`] : []
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
