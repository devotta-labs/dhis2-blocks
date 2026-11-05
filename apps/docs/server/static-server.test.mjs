import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { cp, mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import http from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'

it('serves near-prefix assets without exposing traversal or symlink targets', async () => {
    const root = await mkdtemp(join(tmpdir(), 'docs-static-'))
    const reservation = http.createServer()
    reservation.listen(0, '127.0.0.1')
    await once(reservation, 'listening')
    const port = reservation.address().port
    await reservation[Symbol.asyncDispose]()
    let server
    try {
        await mkdir(join(root, 'server'))
        await mkdir(join(root, 'dist'))
        await cp(
            new URL('../server.mjs', import.meta.url),
            join(root, 'server.mjs')
        )
        await cp(
            new URL('./dhis2-proxy.mjs', import.meta.url),
            join(root, 'server/dhis2-proxy.mjs')
        )
        await writeFile(join(root, 'dist/index.html'), 'docs-shell')
        await writeFile(join(root, 'dist/dhis2-symbol.svg'), 'docs-logo')
        await writeFile(join(root, 'private.txt'), 'outside-private-content')
        await symlink(join(root, 'private.txt'), join(root, 'dist/linked.txt'))
        server = spawn(process.execPath, ['server.mjs'], {
            cwd: root,
            env: { ...process.env, DOCS_PORT: String(port) },
            stdio: ['ignore', 'pipe', 'pipe'],
        })
        await once(server.stdout, 'data')
        const origin = `http://127.0.0.1:${port}`
        expect(await (await fetch(`${origin}/dhis2-symbol.svg`)).text()).toBe(
            'docs-logo'
        )
        for (const path of [
            '/linked.txt',
            '/%2e%2e/private.txt',
            '/..%2fprivate.txt',
        ]) {
            const response = await fetch(`${origin}${path}`)
            expect(await response.text()).toBe('docs-shell')
        }
        expect(
            (await fetch(`${origin}/dhis2-symbol.svg`, { method: 'POST' }))
                .status
        ).toBe(405)
    } finally {
        if (server) {
            const exited = once(server, 'exit')
            server.kill()
            await exited
        }
        await rm(root, { recursive: true, force: true })
    }
})
