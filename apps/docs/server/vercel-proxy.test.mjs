import { createServer } from 'node:http'
import { once } from 'node:events'
import { expect, it, vi } from 'vitest'
import handler from '../../../api/dhis2.mjs'

it('forwards paths and raw bodies without leaking the Vercel origin upstream', async () => {
    const upstream = createServer(async (req, res) => {
        const chunks = []

        for await (const chunk of req) {
            chunks.push(chunk)
        }

        res.setHeader('Content-Type', 'application/json')
        res.end(
            JSON.stringify({
                url: req.url,
                method: req.method,
                headers: req.headers,
                body: Buffer.concat(chunks).toString(),
            })
        )
    })

    const proxy = createServer(handler)

    try {
        upstream.listen(0, '127.0.0.1')
        await once(upstream, 'listening')
        const backend = `http://127.0.0.1:${upstream.address().port}`
        vi.stubEnv('DOCS_DHIS2_URL', `${backend}/dev`)
        proxy.listen(0, '127.0.0.1')
        await once(proxy, 'listening')
        const origin = `http://127.0.0.1:${proxy.address().port}`

        const response = await fetch(`${origin}/dhis2/api/test?fields=id`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Forwarded-Host': 'docs.vercel.app',
                'X-Forwarded-Proto': 'https',
                Forwarded: 'host=docs.vercel.app;proto=https',
            },
            body: '{"test":true}',
        })

        expect(response.status).toBe(200)
        const result = await response.json()
        expect(result).toMatchObject({
            url: '/dev/api/test?fields=id',
            method: 'POST',
            body: '{"test":true}',
            headers: { origin: backend },
        })
        expect(result.headers).not.toHaveProperty('forwarded')
        expect(result.headers).not.toHaveProperty('x-forwarded-host')
        expect(result.headers).not.toHaveProperty('x-forwarded-proto')

        const blocked = await fetch(`${origin}/dhis2/api/test`, {
            method: 'POST',
            headers: { 'Sec-Fetch-Site': 'cross-site' },
        })

        expect(blocked.status).toBe(403)
        expect((await fetch(`${origin}/api/dhis2`)).status).toBe(404)
    } finally {
        vi.unstubAllEnvs()
        proxy.closeAllConnections()
        upstream.closeAllConnections()
        await Promise.all([
            new Promise((resolve) => proxy.close(resolve)),
            new Promise((resolve) => upstream.close(resolve)),
        ])
    }
})
