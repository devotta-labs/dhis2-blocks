import { vi } from 'vitest'
import { openDhis2TestServer } from '../../../test/dhis2-server.test-utils'
import type { DataEngineLike, DataEngineValue } from '../api/client'

interface ResponseFixture {
    body?: DataEngineValue
    status?: number
    disconnect?: boolean
}

const serverVersion = { full: '2.42.0', major: 2, minor: 42, patch: 0 }

export const serveDhis2 = async (
    respond: (request: URL, index: number) => ResponseFixture | undefined
) => {
    const requests: URL[] = []
    const { engine } = await openDhis2TestServer(
        (request) => {
            const reply = respond(request, requests.length)
            requests.push(request)
            if (!reply) {
                return undefined
            }
            if (reply.disconnect) {
                return Response.error()
            }
            const status = reply.status ?? 200
            return Response.json(reply.body ?? { httpStatusCode: status }, {
                status,
            })
        },
        serverVersion.minor,
        serverVersion
    )
    const readEngine: DataEngineLike = engine
    return {
        engine: readEngine,
        query: vi.spyOn(readEngine, 'query'),
        requests,
    }
}
