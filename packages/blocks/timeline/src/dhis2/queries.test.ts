import { Result } from 'better-result'
import { readFileSync } from 'node:fs'
import {
    createTimelineClient,
    type DataEngineLike,
    type DataEngineValue,
} from './client'
import {
    fetchAttributeChangeLogPage,
    fetchEventChangeLogPage,
    fetchEventsPage,
    fetchOrgUnitNames,
    fetchPinnedEvents,
    fetchProgramTimelineMetadata,
    fetchTrackedEntityWithEnrollments,
} from './queries'
import { timelineKeys } from './timelineKeys'

const fixture = (name: string): DataEngineValue =>
    JSON.parse(
        readFileSync(
            new URL(`./__fixtures__/v42/${name}`, import.meta.url),
            'utf8'
        )
    )

const engineReturning = (...bodies: DataEngineValue[]) => {
    const query = vi.fn<DataEngineLike['query']>()
    for (const body of bodies) {
        query.mockResolvedValueOnce({ timelineResource: body })
    }
    return { client: createTimelineClient({ query }), query }
}

const requestOf = (
    query: ReturnType<typeof engineReturning>['query'],
    call = 0
) => Object.values(query.mock.calls[call]?.[0] ?? {})[0]

const event = (
    id: string,
    status: string,
    extra: { scheduledAt?: string } = {}
) => ({
    event: id,
    programStage: 's1',
    status,
    ...extra,
})

describe('fetchEventsPage', () => {
    const options = {
        trackedEntity: 'TlE2eTei001',
        program: 'WSGAb5XwJ3Y',
        timeField: 'occurredAt',
        page: 1,
        pageSize: 4,
    } as const

    it('asks for past events ordered by the chosen time field, excluding SCHEDULE and SKIPPED', async () => {
        const { client, query } = engineReturning(fixture('events-page-1.json'))

        const result = await fetchEventsPage(client, {
            ...options,
            timeField: 'completedAt',
        })

        expect(requestOf(query)).toMatchObject({
            resource: 'tracker/events',
            params: {
                trackedEntity: 'TlE2eTei001',
                program: 'WSGAb5XwJ3Y',
                order: 'completedAt:desc,event:desc',
                page: 1,
                pageSize: 4,
            },
        })
        // No multi-value status filter exists, so the page is filtered here.
        expect(requestOf(query)?.params).not.toHaveProperty('status')
        const page = Result.isOk(result) ? result.value : undefined
        expect(page?.events.map((e) => e.event)).toEqual(['TlE2eEvt004'])
        expect(page?.hasMore).toBe(true)
    })

    it('reports no more pages after a short page', async () => {
        const { client } = engineReturning(fixture('events-page-2.json'))

        const result = await fetchEventsPage(client, { ...options, page: 2 })

        const page = Result.isOk(result) ? result.value : undefined
        expect(page?.events.map((e) => e.event)).toEqual([
            'TlE2eEvt002',
            'TlE2eEvt001',
            'TlE2eEvt007',
        ])
        expect(page?.hasMore).toBe(false)
    })

    it('drops a legacy OVERDUE event from the past stream', async () => {
        const { client } = engineReturning({
            events: [event('e1', 'OVERDUE'), event('e2', 'VISITED')],
        })

        const result = await fetchEventsPage(client, options)

        expect(
            Result.isOk(result) && result.value.events.map((e) => e.event)
        ).toEqual(['e2'])
    })

    it('passes the abort signal to the engine', async () => {
        const { client, query } = engineReturning({ events: [] })
        const signal = new AbortController().signal

        await fetchEventsPage(client, options, signal)

        expect(query.mock.calls[0]?.[1]).toEqual({ signal })
    })
})

describe('fetchPinnedEvents', () => {
    const options = {
        trackedEntity: 'TlE2eTei001',
        program: 'WSGAb5XwJ3Y',
        cap: 2,
    }

    it('asks for pinned events capped at cap + 1, so the caller knows there are more', async () => {
        const { client, query } = engineReturning(
            {
                events: [
                    event('a', 'SCHEDULE', { scheduledAt: '2026-08-01' }),
                    event('b', 'SCHEDULE', { scheduledAt: '2027-01-15' }),
                    event('c', 'SCHEDULE', { scheduledAt: '2027-02-01' }),
                ],
            },
            {
                events: [event('s', 'SKIPPED', { scheduledAt: '2026-04-20' })],
            }
        )

        const result = await fetchPinnedEvents(client, options)

        expect(query).toHaveBeenCalledTimes(2)
        expect([0, 1].map((i) => requestOf(query, i))).toEqual([
            expect.objectContaining({
                resource: 'tracker/events',
                params: expect.objectContaining({
                    trackedEntity: 'TlE2eTei001',
                    program: 'WSGAb5XwJ3Y',
                    status: 'SCHEDULE',
                    order: 'scheduledAt:asc,event:asc',
                    page: 1,
                    pageSize: 3,
                }),
            }),
            expect.objectContaining({
                params: expect.objectContaining({
                    status: 'SKIPPED',
                    pageSize: 3,
                }),
            }),
        ])
        const pinned = Result.isOk(result) ? result.value : undefined
        // Oldest scheduled date first, then cut to the cap.
        expect(pinned?.events.map((e) => e.event)).toEqual(['s', 'a'])
        expect(pinned?.hasMore).toBe(true)
    })

    it('reports no more when both statuses fit within the cap', async () => {
        const { client } = engineReturning(
            fixture('events-schedule.json'),
            fixture('events-skipped.json')
        )

        const result = await fetchPinnedEvents(client, { ...options, cap: 50 })

        const pinned = Result.isOk(result) ? result.value : undefined
        expect(pinned?.events.map((e) => e.event)).toEqual([
            'TlE2eEvt003',
            'TlE2eEvt005',
            'TlE2eEvt006',
        ])
        expect(pinned?.hasMore).toBe(false)
    })

    it('fails when either status request fails', async () => {
        const query = vi
            .fn<DataEngineLike['query']>()
            .mockResolvedValueOnce({ timelineResource: { events: [] } })
            .mockRejectedValueOnce(new Error('Server error'))

        const result = await fetchPinnedEvents(
            createTimelineClient({ query }),
            options
        )

        expect(Result.isError(result) && result.error.message).toContain(
            'Server error'
        )
    })
})

describe('fetchTrackedEntityWithEnrollments', () => {
    it("asks for one tracked entity with the program's enrollments and notes", async () => {
        const { client, query } = engineReturning(
            fixture('tracked-entity.json')
        )

        const result = await fetchTrackedEntityWithEnrollments(client, {
            trackedEntity: 'TlE2eTei001',
            program: 'WSGAb5XwJ3Y',
        })

        const request = requestOf(query)
        expect(request).toMatchObject({
            resource: 'tracker/trackedEntities',
            id: 'TlE2eTei001',
            params: { program: 'WSGAb5XwJ3Y' },
        })
        expect(request?.params?.fields).toContain('enrollments[')
        expect(request?.params?.fields).toContain('notes[')
        expect(
            Result.isOk(result) &&
                result.value.enrollments.map((e) => e.enrollment).sort()
        ).toEqual(['TlE2eEnr001', 'TlE2eEnr002'])
    })

    it('keeps only enrollments in the program', async () => {
        const { client } = engineReturning({
            trackedEntity: 'te1',
            enrollments: [
                { enrollment: 'en1', program: 'p1', status: 'ACTIVE' },
                { enrollment: 'en2', program: 'other', status: 'ACTIVE' },
            ],
        })

        const result = await fetchTrackedEntityWithEnrollments(client, {
            trackedEntity: 'te1',
            program: 'p1',
        })

        expect(
            Result.isOk(result) &&
                result.value.enrollments.map((e) => e.enrollment)
        ).toEqual(['en1'])
    })
})

describe('changelog pages', () => {
    it('asks for attribute changelog newest first, paged', async () => {
        const { client, query } = engineReturning(
            fixture('tracked-entity-changelog.json')
        )

        const result = await fetchAttributeChangeLogPage(client, {
            trackedEntity: 'TlE2eTei001',
            program: 'WSGAb5XwJ3Y',
            page: 1,
            pageSize: 7,
        })

        expect(requestOf(query)).toEqual({
            resource: 'tracker/trackedEntities/TlE2eTei001/changeLogs',
            params: {
                program: 'WSGAb5XwJ3Y',
                order: 'createdAt:desc',
                page: 1,
                pageSize: 7,
            },
        })
        const page = Result.isOk(result) ? result.value : undefined
        expect(page?.rows).toHaveLength(7)
        expect(page?.hasMore).toBe(true)
    })

    it('asks for one event changelog newest first, paged', async () => {
        const { client, query } = engineReturning(
            fixture('event-changelog.json')
        )

        const result = await fetchEventChangeLogPage(client, {
            event: 'TlE2eEvt004',
            page: 2,
            pageSize: 50,
        })

        expect(requestOf(query)).toEqual({
            resource: 'tracker/events/TlE2eEvt004/changeLogs',
            params: { order: 'createdAt:desc', page: 2, pageSize: 50 },
        })
        expect(Result.isOk(result) && result.value.hasMore).toBe(false)
    })
})

describe('fetchProgramTimelineMetadata', () => {
    it('asks for stages, report flags, due-date visibility and attributes', async () => {
        const { client, query } = engineReturning(
            fixture('program-metadata.json')
        )

        const result = await fetchProgramTimelineMetadata(client, {
            program: 'WSGAb5XwJ3Y',
        })

        const request = requestOf(query)
        expect(request).toMatchObject({
            resource: 'programs',
            id: 'WSGAb5XwJ3Y',
        })
        for (const field of [
            'hideDueDate',
            'displayInReports',
            'programTrackedEntityAttributes',
            'optionSet[options[code,displayName]]',
        ]) {
            expect(request?.params?.fields).toContain(field)
        }
        expect(Result.isOk(result)).toBe(true)
    })
})

describe('fetchOrgUnitNames', () => {
    it('asks for org unit names in one request for all ids', async () => {
        const { client, query } = engineReturning(
            fixture('org-unit-names.json')
        )

        const result = await fetchOrgUnitNames(client, {
            ids: ['DiszpKrYNg8', 'ImspTQPwCqd'],
        })

        expect(query).toHaveBeenCalledTimes(1)
        expect(requestOf(query)).toEqual({
            resource: 'organisationUnits',
            params: {
                filter: 'id:in:[DiszpKrYNg8,ImspTQPwCqd]',
                fields: 'id,displayName',
                paging: false,
            },
        })
        expect(Result.isOk(result) && result.value).toContainEqual({
            id: 'ImspTQPwCqd',
            displayName: 'Sierra Leone',
        })
    })

    it('makes no request for no ids', async () => {
        const { client, query } = engineReturning()

        const result = await fetchOrgUnitNames(client, { ids: [] })

        expect(query).not.toHaveBeenCalled()
        expect(Result.isOk(result) && result.value).toEqual([])
    })
})

describe('errors', () => {
    it('returns an error result, not a throw, on HTTP failure and on a schema mismatch', async () => {
        const failing = createTimelineClient({
            query: vi
                .fn<DataEngineLike['query']>()
                .mockRejectedValue(
                    Object.assign(new Error('Not found'), { status: 404 })
                ),
        })
        const httpResult = await fetchEventChangeLogPage(failing, {
            event: 'e1',
            page: 1,
            pageSize: 50,
        })
        expect(
            Result.isError(httpResult) && httpResult.error.message
        ).toContain('Not found')

        const { client } = engineReturning({ unexpected: true })
        const schemaResult = await fetchTrackedEntityWithEnrollments(client, {
            trackedEntity: 'te1',
            program: 'p1',
        })
        expect(
            Result.isError(schemaResult) && schemaResult.error.message
        ).toContain('Invalid tracker/trackedEntities response')
    })
})

describe('timelineKeys', () => {
    it('starts every key with the root, so one invalidation refreshes all', () => {
        const keys = [
            timelineKeys.events('te', 'p', 'occurredAt'),
            timelineKeys.trackedEntity('te', 'p'),
            timelineKeys.attributeChangeLog('te', 'p'),
            timelineKeys.eventChangeLog('e'),
            timelineKeys.programMetadata('p'),
            timelineKeys.orgUnitNames(['a', 'b']),
        ]

        for (const key of keys) {
            expect(key.slice(0, timelineKeys.root.length)).toEqual([
                ...timelineKeys.root,
            ])
        }
        expect(new Set(keys.map((key) => key[1])).size).toBe(keys.length)
    })
})
