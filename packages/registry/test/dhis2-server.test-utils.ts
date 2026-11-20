import { once } from 'node:events'
import { createServer } from 'node:http'
import type { IncomingMessage } from 'node:http'
import { DataProvider, useDataEngine } from '@dhis2/app-runtime'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, onTestFinished } from 'vitest'

type Dhis2Route = (
    url: URL,
    request: IncomingMessage
) => Response | undefined | Promise<Response | undefined>

export const openDhis2TestServer = async (
    route: Dhis2Route,
    apiVersion = 42
) => {
    const unexpectedRequests: string[] = []
    const errors: Error[] = []
    const server = createServer(async (request, reply) => {
        try {
            const url = new URL(request.url ?? '/', 'http://127.0.0.1')
            const response = await route(url, request)
            if (!response) {
                unexpectedRequests.push(`${request.method} ${url.pathname}`)
                reply.writeHead(404).end()
                return
            }
            if (response.type === 'error') {
                reply.destroy()
                return
            }
            reply.writeHead(
                response.status,
                Object.fromEntries(response.headers)
            )
            reply.end(Buffer.from(await response.arrayBuffer()))
        } catch (error) {
            errors.push(
                error instanceof Error ? error : new Error(String(error))
            )
            reply.destroy()
        }
    })

    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    onTestFinished(async () => {
        try {
            const closed = once(server, 'close')
            server.close()
            server.closeAllConnections()
            await closed
        } finally {
            expect(errors).toEqual([])
            expect(unexpectedRequests).toEqual([])
        }
    })

    const address = server.address()
    if (!(address instanceof Object)) {
        throw new Error('DHIS2 test server did not bind to a TCP port')
    }
    const baseUrl = `http://127.0.0.1:${address.port}`
    const { promise, resolve } =
        Promise.withResolvers<ReturnType<typeof useDataEngine>>()
    function CaptureEngine() {
        const engine = useDataEngine()
        resolve(engine)
        return null
    }
    renderToStaticMarkup(
        createElement(DataProvider, {
            baseUrl,
            apiVersion,
            children: createElement(CaptureEngine),
        })
    )
    return { baseUrl, engine: await promise }
}
