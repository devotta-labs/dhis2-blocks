import { Result } from 'better-result'
import { readFileSync } from 'node:fs'
import { z } from 'zod'
import {
    createTimelineClient,
    type DataEngineLike,
    type DataEngineValue,
} from './client'
import {
    fetchAttributeChangeLog,
    fetchEventChangeLog,
    fetchEvents,
    fetchOrgUnitNames,
    fetchProgramTimelineMetadata,
    fetchTrackedEntity,
} from './queries'
import { timelineKeys } from './timelineKeys'

/** A recorded changelog page, rows kept as raw JSON so a test can alter them. */
const RecordedChangeLogsSchema = z.object({
    changeLogs: z.array(z.record(z.string(), z.json())),
})

const fixture = (name: string): DataEngineValue =>
    JSON.parse(
        readFileSync(
            new URL(`./__tests__/fixtures/v42/${name}`, import.meta.url),
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

const event = (id: string, status: string) => ({
    event: id,
    programStage: 's1',
    status,
})

describe('fetchEvents', () => {
    const options = {
        trackedEntity: 'TlE2eTei001',
        program: 'WSGAb5XwJ3Y',
        timeField: 'occurredAt',
        cap: 3,
    } as const

    it('asks for one program, every status, newest first, cap + 1 rows', async () => {
        const { client, query } = engineReturning(fixture('events-page-1.json'))

        await fetchEvents(client, options)

        const request = requestOf(query)
        expect(request).toMatchObject({
            resource: 'tracker/events',
            params: {
                trackedEntity: 'TlE2eTei001',
                program: 'WSGAb5XwJ3Y',
                order: 'occurredAt:desc,event:asc',
                page: 1,
                pageSize: 4,
            },
        })
        expect(request?.params).not.toHaveProperty('status')
    })

    it('keeps cap rows and says when more exist', async () => {
        const { client } = engineReturning({
            events: [
                event('a', 'SCHEDULE'),
                event('b', 'COMPLETED'),
                event('c', 'SKIPPED'),
                event('d', 'ACTIVE'),
            ],
        })

        const result = await fetchEvents(client, options)

        const value = Result.isOk(result) ? result.value : undefined
        expect(value?.events.map((e) => e.event)).toEqual(['a', 'b', 'c'])
        expect(value?.capped).toBe(true)
    })

    it('is not capped when the answer fits', async () => {
        const { client } = engineReturning({ events: [event('a', 'ACTIVE')] })

        const result = await fetchEvents(client, options)

        expect(Result.isOk(result) && result.value.capped).toBe(false)
    })

    it('passes the abort signal to the engine', async () => {
        const { client, query } = engineReturning({ events: [] })
        const controller = new AbortController()

        await fetchEvents(client, options, controller.signal)

        expect(query.mock.calls[0]?.[1]).toEqual({ signal: controller.signal })
    })
})

describe('fetchTrackedEntity', () => {
    it('asks for one tracked entity with every enrollment and its notes, no program', async () => {
        const { client, query } = engineReturning(
            fixture('tracked-entity.json')
        )

        const result = await fetchTrackedEntity(client, {
            trackedEntity: 'TlE2eTei001',
        })

        const request = requestOf(query)
        expect(request).toMatchObject({
            resource: 'tracker/trackedEntities',
            id: 'TlE2eTei001',
        })
        expect(request?.params).not.toHaveProperty('program')
        expect(request?.params?.fields).toContain('enrollments[')
        expect(request?.params?.fields).toContain('notes[')
        expect(
            Result.isOk(result) &&
                result.value.enrollments.map((e) => e.enrollment).sort()
        ).toEqual(['TlE2eEnr001', 'TlE2eEnr002'])
    })
})

describe('changelogs', () => {
    type RawRow = z.infer<typeof RecordedChangeLogsSchema>['changeLogs'][number]

    const rowsOf = (count: number): RawRow[] => {
        const { changeLogs } = RecordedChangeLogsSchema.parse(
            fixture('tracked-entity-changelog.json')
        )
        return Array.from({ length: count }, (_, index) => ({
            ...changeLogs[index % changeLogs.length],
            createdAt: `2026-10-22T10:00:${String(index % 60).padStart(2, '0')}.000`,
        }))
    }

    it("asks for one program's attribute changelog newest first, 100 at a time", async () => {
        const { client, query } = engineReturning(
            fixture('tracked-entity-changelog.json')
        )

        const result = await fetchAttributeChangeLog(client, {
            trackedEntity: 'TlE2eTei001',
            program: 'WSGAb5XwJ3Y',
            maxRows: 500,
        })

        expect(requestOf(query)).toEqual({
            resource: 'tracker/trackedEntities/TlE2eTei001/changeLogs',
            params: {
                program: 'WSGAb5XwJ3Y',
                order: 'createdAt:desc',
                page: 1,
                pageSize: 100,
            },
        })
        expect(query).toHaveBeenCalledTimes(1)
        const value = Result.isOk(result) ? result.value : undefined
        expect(value?.rows).toHaveLength(7)
        expect(value?.truncated).toBe(false)
    })

    it('reads pages until a short one, counting unknown rows toward a full page', async () => {
        const full = rowsOf(100)
        full[0] = { ...full[0], change: { somethingNew: { id: 'x' } } }
        const { client, query } = engineReturning(
            { changeLogs: full },
            { changeLogs: rowsOf(3) }
        )

        const result = await fetchAttributeChangeLog(client, {
            trackedEntity: 'te',
            program: 'p',
            maxRows: 500,
        })

        expect(query).toHaveBeenCalledTimes(2)
        expect(requestOf(query, 1)?.params?.page).toBe(2)
        expect(Result.isOk(result) && result.value.rows).toHaveLength(102)
    })

    it('asks once more when exactly maxRows came on full pages, and is not truncated', async () => {
        const { client, query } = engineReturning(
            { changeLogs: rowsOf(100) },
            { changeLogs: rowsOf(100) },
            { changeLogs: [] }
        )

        const result = await fetchEventChangeLog(client, {
            event: 'TlE2eEvt004',
            maxRows: 200,
        })

        expect(query).toHaveBeenCalledTimes(3)
        const value = Result.isOk(result) ? result.value : undefined
        expect(value?.rows).toHaveLength(200)
        expect(value?.truncated).toBe(false)
    })

    it('stops at maxRows and says the rest were left out', async () => {
        const { client, query } = engineReturning(
            { changeLogs: rowsOf(100) },
            { changeLogs: rowsOf(100) }
        )

        const result = await fetchEventChangeLog(client, {
            event: 'TlE2eEvt004',
            maxRows: 150,
        })

        expect(requestOf(query)).toEqual({
            resource: 'tracker/events/TlE2eEvt004/changeLogs',
            params: { order: 'createdAt:desc', page: 1, pageSize: 100 },
        })
        const value = Result.isOk(result) ? result.value : undefined
        expect(value?.rows).toHaveLength(150)
        expect(value?.truncated).toBe(true)
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
        const httpResult = await fetchEventChangeLog(failing, {
            event: 'e1',
            maxRows: 500,
        })
        expect(
            Result.isError(httpResult) && httpResult.error.message
        ).toContain('Not found')

        const { client } = engineReturning({ unexpected: true })
        const schemaResult = await fetchTrackedEntity(client, {
            trackedEntity: 'te1',
        })
        expect(
            Result.isError(schemaResult) && schemaResult.error.message
        ).toContain('Invalid tracker/trackedEntities response')
    })
})

describe('timelineKeys', () => {
    it('starts every key with the root, so one invalidation refreshes all', () => {
        const keys = [
            timelineKeys.events('te', 'p', 'occurredAt', 500),
            timelineKeys.trackedEntity('te'),
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
