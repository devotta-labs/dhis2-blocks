import { describe, expect, it } from 'vitest'
import { createAppServer, HEADER_RESOURCES } from '../appServer'

const server = createAppServer(async (request) => ({ list: request.resource }))

describe('the shell lab app server', () => {
    it('answers every header bar resource itself', async () => {
        for (const resource of HEADER_RESOURCES) {
            expect(await server({ resource }, 'read')).not.toHaveProperty(
                'list'
            )
        }
    })

    it("answers the header bar's me with the user, and the list's me from the list", async () => {
        expect(
            await server(
                { resource: 'me', params: { fields: 'authorities,name' } },
                'read'
            )
        ).toMatchObject({ name: 'Lab Nurse' })
        expect(
            await server(
                { resource: 'me', params: { fields: 'organisationUnits' } },
                'read'
            )
        ).toEqual({ list: 'me' })
    })

    it('sends everything else to the list', async () => {
        expect(await server({ resource: 'tracker/events' }, 'read')).toEqual({
            list: 'tracker/events',
        })
    })
})
