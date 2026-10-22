import { Result } from 'better-result'
import {
    EVENT_FIELDS,
    EventsPageSchema,
    toEventEntry,
    type TimelineClient,
} from '@dhis2-blocks/timeline/dhis2'
import { updatedTodaySource } from './updatedTodaySource'

type Request = Parameters<TimelineClient['query']>[0]

const event = (id: string, updatedAt: string, status = 'COMPLETED') => ({
    event: id,
    status,
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

const signal = new AbortController().signal

describe('updatedTodaySource', () => {
    it("asks for events updated in today's window for one program and org unit, paged", async () => {
        const { client, requests } = fakeClient(
            { events: [event('e1', '2026-10-22T09:00:00.000')] },
            { events: [] }
        )
        const source = updatedTodaySource({
            client,
            program: 'prg',
            orgUnit: 'ou',
            today: '2026-10-22',
            pageSize: 1,
        })

        const first = await source.fetchPage(undefined, signal)

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
        expect(source.key).toBe('events')
        if (Result.isError(first)) {
            throw first.error
        }
        // A full page may have a next one, and claims complete down to its last row.
        expect(first.value.completeUntil).toBe('2026-10-22T09:00:00.000')
        const cursor = first.value.nextCursor

        await source.fetchPage(cursor, signal)

        expect(requests[1]?.params?.page).toBe(2)
    })

    it('rolls the window over month and year ends', async () => {
        const { client, requests } = fakeClient({ events: [] })
        await updatedTodaySource({
            client,
            program: 'prg',
            orgUnit: 'ou',
            today: '2026-12-31',
        }).fetchPage(undefined, signal)

        expect(requests[0]?.params).toMatchObject({
            updatedAfter: '2026-12-31T00:00:00',
            updatedBefore: '2027-01-01T00:00:00',
        })
    })

    it('stops paging when a page comes back short', async () => {
        const { client } = fakeClient({
            events: [event('e1', '2026-10-22T09:00:00.000')],
        })
        const page = await updatedTodaySource({
            client,
            program: 'prg',
            orgUnit: 'ou',
            today: '2026-10-22',
            pageSize: 5,
        }).fetchPage(undefined, signal)

        if (Result.isError(page)) {
            throw page.error
        }
        expect(page.value.nextCursor).toBeUndefined()
    })

    it('produces the same entries the events source does, so the case-history event composition renders them unchanged', async () => {
        const body = {
            events: [
                event('e1', '2026-10-22T09:00:00.000'),
                event('e2', '2026-10-22T08:00:00.000', 'SCHEDULE'),
            ],
        }
        const { client } = fakeClient(body)
        const page = await updatedTodaySource({
            client,
            program: 'prg',
            orgUnit: 'ou',
            today: '2026-10-22',
        }).fetchPage(undefined, signal)

        if (Result.isError(page)) {
            throw page.error
        }
        expect(page.value.entries).toEqual(
            EventsPageSchema.parse(body).map((parsed) =>
                toEventEntry(parsed, {
                    sourceKey: 'events',
                    timeField: 'updatedAt',
                    today: '2026-10-22',
                })
            )
        )
        expect(page.value.entries.map((entry) => entry.sourceKey)).toEqual([
            'events',
            'events',
        ])
    })

    it('reports a failed request as a failed source', async () => {
        const { client } = fakeClient('not an events page')
        const page = await updatedTodaySource({
            client,
            program: 'prg',
            orgUnit: 'ou',
            today: '2026-10-22',
        }).fetchPage(undefined, signal)

        if (Result.isOk(page)) {
            throw new Error('expected a failure')
        }
        expect(page.error.kind).toBe('failed')
    })
})
