import { z } from 'zod'
import { RMNCH, rmnchEnrollmentResponse } from '../__tests__/rmnch'
import { engineOver } from '../__tests__/serve'
import { fetchRuleEnrollments } from './enrollment'

/** A request as the data engine hands it to the server. */
const RequestSchema = z.object({
    resource: z.string(),
    params: z.record(z.string(), z.json()).optional(),
})

/** Records each request and answers every requested enrollment with the RMNCH one, under its own id, in the list body the API sends. */
const fakeServer = async () => {
    const requests: Array<z.infer<typeof RequestSchema>> = []
    const engine = await engineOver({
        'tracker/enrollments': async (_type, query) => {
            const request = RequestSchema.parse(query)
            requests.push(request)
            const ids = String(request.params?.enrollments).split(',')
            return z.json().parse({
                pager: { page: 1, pageSize: ids.length },
                enrollments: ids.map((id) => ({
                    ...rmnchEnrollmentResponse,
                    enrollment: id,
                })),
            })
        },
    })
    return { engine, requests }
}

describe('fetchRuleEnrollments', () => {
    it('fetches many enrollments in one comma-separated request', async () => {
        const { engine, requests } = await fakeServer()
        await fetchRuleEnrollments(
            engine,
            RMNCH.programId,
            ['a', 'b', 'c'],
            true
        )
        expect(requests).toHaveLength(1)
        expect(requests[0]?.resource).toBe('tracker/enrollments')
        expect(requests[0]?.params?.enrollments).toBe('a,b,c')
        // DHIS2 2.43 refuses a list of enrollments without its program (E1003).
        expect(requests[0]?.params?.program).toBe(RMNCH.programId)
        expect(requests[0]?.params?.pageSize).toBe(3)
        expect(requests[0]?.params?.fields).toContain('events[')
    })

    it('leaves out the events when they are not needed', async () => {
        const { engine, requests } = await fakeServer()
        await fetchRuleEnrollments(engine, RMNCH.programId, ['a'], false)
        expect(requests[0]?.params?.fields).not.toContain('events[')
    })

    it('splits more than 100 enrollments into requests of 100', async () => {
        const { engine, requests } = await fakeServer()
        const ids = Array.from({ length: 120 }, (_, i) => `en${i}`)
        const result = await fetchRuleEnrollments(
            engine,
            RMNCH.programId,
            ids,
            true
        )
        expect(requests.map((r) => r.params?.pageSize)).toEqual([100, 20])
        expect(result.size).toBe(120)
    })

    it('maps each enrollment by its id', async () => {
        const { engine } = await fakeServer()
        const result = await fetchRuleEnrollments(
            engine,
            RMNCH.programId,
            [RMNCH.enrollmentId, 'other'],
            true
        )
        expect(result.get(RMNCH.enrollmentId)?.events).toHaveLength(8)
        expect(result.get('other')?.enrollment.id).toBe('other')
    })

    it('asks for nothing when there are no enrollments', async () => {
        const { engine, requests } = await fakeServer()
        const result = await fetchRuleEnrollments(
            engine,
            RMNCH.programId,
            [],
            true
        )
        expect(requests).toHaveLength(0)
        expect(result.size).toBe(0)
    })
})
