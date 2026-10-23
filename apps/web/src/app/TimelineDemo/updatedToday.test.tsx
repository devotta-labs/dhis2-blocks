import { Result } from 'better-result'
import { EVENT_FIELDS, type TimelineClient } from '@/components/timeline-dhis2'
import { fetchUpdatedToday } from './updatedToday'

type Request = Parameters<TimelineClient['query']>[0]

const event = (id: string, updatedAt: string) => ({
    event: id,
    status: 'COMPLETED',
    program: 'prg',
    programStage: 'stage',
    orgUnit: 'ou',
    occurredAt: updatedAt,
    updatedAt,
    dataValues: [],
    notes: [],
})

/** A client that records requests and answers each with the next body. */
const fakeClient = (...bodies: unknown[]) => {
    const requests: Request[] = []
    const client: TimelineClient = {
        async query(request, schema) {
            requests.push(request)
            const parsed = schema.safeParse(bodies[requests.length - 1])
            return parsed.success
                ? Result.ok(parsed.data)
                : Result.err(new Error('unexpected body'))
        },
    }
    return { client, requests }
}

const options = {
    program: 'prg',
    orgUnit: 'ou',
    today: '2026-10-22',
    page: 1,
    pageSize: 1,
}

describe('fetchUpdatedToday', () => {
    it("asks for events updated in today's window for one program and org unit", async () => {
        const { client, requests } = fakeClient({
            events: [event('e1', '2026-10-22T09:00:00.000')],
        })

        const result = await fetchUpdatedToday(client, options)

        expect(requests[0]).toEqual({
            resource: 'tracker/events',
            params: {
                program: 'prg',
                orgUnit: 'ou',
                updatedAfter: '2026-10-22T00:00:00',
                updatedBefore: '2026-10-23T00:00:00',
                fields: EVENT_FIELDS,
                order: 'updatedAt:desc,event:asc',
                page: 1,
                pageSize: 1,
            },
        })
        // A full page may have a next one.
        expect(Result.isOk(result) && result.value.nextPage).toBe(2)
    })

    it('rolls the window over month and year ends', async () => {
        const { client, requests } = fakeClient({ events: [] })

        await fetchUpdatedToday(client, { ...options, today: '2026-12-31' })

        expect(requests[0]?.params).toMatchObject({
            updatedAfter: '2026-12-31T00:00:00',
            updatedBefore: '2027-01-01T00:00:00',
        })
    })

    it('stops paging when a page comes back short', async () => {
        const { client } = fakeClient({
            events: [event('e1', '2026-10-22T09:00:00.000')],
        })

        const result = await fetchUpdatedToday(client, {
            ...options,
            pageSize: 5,
        })

        expect(Result.isOk(result) && result.value).toEqual({
            events: [expect.objectContaining({ event: 'e1' })],
        })
    })

    it('reports a bad answer as an error result', async () => {
        const { client } = fakeClient('not an events page')

        const result = await fetchUpdatedToday(client, options)

        expect(Result.isError(result)).toBe(true)
    })
})
