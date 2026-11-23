import type { IncomingMessage } from 'node:http'
import { z } from 'zod'
import { openDhis2TestServer } from '../../../test/dhis2-server.test-utils'
import { createRuntimeWorkingListClient } from '../provider/engineAdapter'

export const openWorkingListServer = async (
    route: Parameters<typeof openDhis2TestServer>[0],
    apiVersion = 43
) => {
    const { baseUrl, engine } = await openDhis2TestServer(route, apiVersion)
    return { baseUrl, client: createRuntimeWorkingListClient(engine) }
}

export const readRequestJson = async (request: IncomingMessage) => {
    request.setEncoding('utf8')
    let body = ''
    for await (const chunk of request) {
        body += String(chunk)
    }
    return z.json().parse(JSON.parse(body))
}
