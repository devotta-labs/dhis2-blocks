import { RMNCH, rmnchEnrollmentResponse } from '../__tests__/rmnch'
import type { ProgramRulesClient } from './client'
import { fetchRuleEnrollments } from './enrollment'

type RecordedRequest = Parameters<ProgramRulesClient['query']>[0][string]

/** Records each request and answers every requested enrollment with the RMNCH one, under its own id, in the list body the API sends. */
const fakeClient = () => {
    const requests: RecordedRequest[] = []
    const client: ProgramRulesClient = {
        query: async (query, schema) => {
            const request = query.enrollments!
            requests.push(request)
            const ids = String(request.params?.enrollments).split(',')
            return schema.parse({
                enrollments: {
                    pager: { page: 1, pageSize: ids.length },
                    enrollments: ids.map((id) => ({
                        ...rmnchEnrollmentResponse,
                        enrollment: id,
                    })),
                },
            })
        },
    }
    return { client, requests }
}

describe('fetchRuleEnrollments', () => {
    it('fetches many enrollments in one comma-separated request', async () => {
        const { client, requests } = fakeClient()
        await fetchRuleEnrollments(client, ['a', 'b', 'c'], true)
        expect(requests).toHaveLength(1)
        expect(requests[0]?.resource).toBe('tracker/enrollments')
        expect(requests[0]?.params?.enrollments).toBe('a,b,c')
        expect(requests[0]?.params?.pageSize).toBe(3)
        expect(requests[0]?.params?.fields).toContain('events[')
    })

    it('leaves out the events when they are not needed', async () => {
        const { client, requests } = fakeClient()
        await fetchRuleEnrollments(client, ['a'], false)
        expect(requests[0]?.params?.fields).not.toContain('events[')
    })

    it('splits more than 100 enrollments into requests of 100', async () => {
        const { client, requests } = fakeClient()
        const ids = Array.from({ length: 120 }, (_, i) => `en${i}`)
        const result = await fetchRuleEnrollments(client, ids, true)
        expect(requests.map((r) => r.params?.pageSize)).toEqual([100, 20])
        expect(result.size).toBe(120)
    })

    it('maps each enrollment by its id', async () => {
        const { client } = fakeClient()
        const result = await fetchRuleEnrollments(
            client,
            [RMNCH.enrollmentId, 'other'],
            true
        )
        expect(result.get(RMNCH.enrollmentId)?.events).toHaveLength(8)
        expect(result.get('other')?.enrollment.id).toBe('other')
    })

    it('asks for nothing when there are no enrollments', async () => {
        const { client, requests } = fakeClient()
        const result = await fetchRuleEnrollments(client, [], true)
        expect(requests).toHaveLength(0)
        expect(result.size).toBe(0)
    })
})
