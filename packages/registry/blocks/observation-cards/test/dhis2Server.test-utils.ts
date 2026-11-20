import { vi } from 'vitest'
import { openDhis2TestServer } from '../../../test/dhis2-server.test-utils'
import type { DataEngineLike, DataEngineValue } from '../api/client'

interface ResponseFixture {
    body?: DataEngineValue
    status?: number
    disconnect?: boolean
}

export const serveDhis2 = async (
    respond: (request: URL, index: number) => ResponseFixture | undefined
) => {
    let index = 0
    const { engine } = await openDhis2TestServer((request) => {
        const reply = respond(request, index++)
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
    })
    const readEngine: DataEngineLike = engine
    return { engine: readEngine, query: vi.spyOn(readEngine, 'query') }
}
