import {
    CustomDataProvider,
    FetchError,
    useDataEngine,
} from '@dhis2/app-runtime'
import React, { type ComponentProps, type ReactNode } from 'react'
import { renderHook } from 'vitest-browser-react'
import { z } from 'zod'
import eventsPage from './__tests__/fixtures/v42/events-page-1.json'
import orgUnitNames from './__tests__/fixtures/v42/org-unit-names.json'
import programMetadata from './__tests__/fixtures/v42/program-metadata.json'
import attributeChangelog from './__tests__/fixtures/v42/tracked-entity-changelog.json'
import trackedEntity from './__tests__/fixtures/v42/tracked-entity.json'
import {
    fetchAttributeChangeLog,
    fetchEventChangeLog,
    fetchEvents,
    fetchOrgUnitNames,
    fetchProgramTimelineMetadata,
    fetchTrackedEntity,
    shouldRetryRequest,
} from './queries'
import { timelineKeys } from './timelineKeys'

type CustomData = ComponentProps<typeof CustomDataProvider>['data']

/** A request as the data engine hands it to the server. */
const RequestSchema = z.object({
    resource: z.string(),
    id: z.string().optional(),
    params: z.record(z.string(), z.json()).optional(),
})
type Request = z.infer<typeof RequestSchema>

const BodySchema = z.json()
type Body = z.infer<typeof BodySchema>

/** A recorded changelog page, rows kept as raw JSON so a test can alter them. */
const RecordedChangeLogsSchema = z.object({
    changeLogs: z.array(z.record(z.string(), z.json())),
})

/**
 * The app-runtime engine over a fake server that answers `resource` with
 * `answers` in order; an `Error` fails that request.
 */
const engineAnswering = async (
    resource: string,
    ...answers: Array<Body | Error>
) => {
    const requests: Request[] = []
    const signals: Array<AbortSignal | undefined> = []
    const data: CustomData = {
        [resource]: async (_type, query, options) => {
            const answer = answers[requests.length]
            requests.push(RequestSchema.parse(query))
            signals.push(options?.signal)
            if (answer === undefined) {
                throw new Error(`unexpected request ${requests.length}`)
            }
            if (answer instanceof Error) {
                throw answer
            }
            return answer
        },
    }
    const wrapper = ({ children }: { children: ReactNode }) => (
        <CustomDataProvider data={data}>{children}</CustomDataProvider>
    )
    const { result } = await renderHook(() => useDataEngine(), { wrapper })
    return { engine: result.current, requests, signals }
}

const failure = (httpStatusCode: number) =>
    new FetchError({
        type: 'unknown',
        message: `An unknown error occurred - (${httpStatusCode})`,
        details: { httpStatusCode },
    })

const event = (id: string, status: string) => ({
    event: id,
    programStage: 's1',
    status,
})

describe('shouldRetryRequest', () => {
    it.each([
        { name: 'a server error', error: failure(500), retried: true },
        { name: 'a client error', error: failure(400), retried: false },
        {
            name: 'a network failure',
            error: new FetchError({
                type: 'network',
                message: 'offline',
                details: {},
            }),
            retried: true,
        },
        {
            name: 'no access',
            error: new FetchError({
                type: 'access',
                message: 'forbidden',
                details: { httpStatusCode: 403 },
            }),
            retried: false,
        },
        {
            name: 'a malformed response',
            error: new Error('Invalid input'),
            retried: false,
        },
    ])('$name: retried is $retried', ({ error, retried }) => {
        expect(shouldRetryRequest(0, error)).toBe(retried)
        expect(shouldRetryRequest(1, error)).toBe(retried)
        expect(shouldRetryRequest(2, error)).toBe(false)
    })
})

describe('fetchEvents', () => {
    const options = {
        trackedEntity: 'TlE2eTei001',
        program: 'WSGAb5XwJ3Y',
        timeField: 'occurredAt',
        cap: 3,
    } as const

    it('asks for one program, every status, newest first, cap + 1 rows', async () => {
        const { engine, requests } = await engineAnswering(
            'tracker/events',
            BodySchema.parse(eventsPage)
        )

        await fetchEvents(engine, options)

        expect(requests[0]).toMatchObject({
            resource: 'tracker/events',
            params: {
                trackedEntity: 'TlE2eTei001',
                program: 'WSGAb5XwJ3Y',
                order: 'occurredAt:desc,event:asc',
                page: 1,
                pageSize: 4,
            },
        })
        expect(requests[0]?.params).not.toHaveProperty('status')
    })

    it('keeps cap rows and says when more exist', async () => {
        const { engine } = await engineAnswering('tracker/events', {
            events: [
                event('a', 'SCHEDULE'),
                event('b', 'COMPLETED'),
                event('c', 'SKIPPED'),
                event('d', 'ACTIVE'),
            ],
        })

        const result = await fetchEvents(engine, options)

        expect(result.events.map((e) => e.event)).toEqual(['a', 'b', 'c'])
        expect(result.capped).toBe(true)
    })

    it('is not capped when the answer fits', async () => {
        const { engine } = await engineAnswering('tracker/events', {
            events: [event('a', 'ACTIVE')],
        })

        const result = await fetchEvents(engine, options)

        expect(result.capped).toBe(false)
    })

    it('passes the abort signal to the engine', async () => {
        const { engine, signals } = await engineAnswering('tracker/events', {
            events: [],
        })
        const controller = new AbortController()

        await fetchEvents(engine, options, controller.signal)

        expect(signals).toEqual([controller.signal])
    })
})

describe('fetchTrackedEntity', () => {
    it('asks for one tracked entity with every enrollment and its notes, no program', async () => {
        const { engine, requests } = await engineAnswering(
            'tracker/trackedEntities',
            BodySchema.parse(trackedEntity)
        )

        const result = await fetchTrackedEntity(engine, {
            trackedEntity: 'TlE2eTei001',
        })

        const [request] = requests
        expect(request).toMatchObject({
            resource: 'tracker/trackedEntities',
            id: 'TlE2eTei001',
        })
        expect(request?.params).not.toHaveProperty('program')
        expect(request?.params?.fields).toContain('enrollments[')
        expect(request?.params?.fields).toContain('notes[')
        expect(result.enrollments.map((e) => e.enrollment).sort()).toEqual([
            'TlE2eEnr001',
            'TlE2eEnr002',
        ])
    })
})

describe('changelogs', () => {
    const ATTRIBUTES = 'tracker/trackedEntities/TlE2eTei001/changeLogs'
    const EVENT = 'tracker/events/TlE2eEvt004/changeLogs'
    const recorded = RecordedChangeLogsSchema.parse(attributeChangelog)

    const rowsOf = (count: number): typeof recorded => ({
        changeLogs: Array.from({ length: count }, (_, index) => ({
            ...recorded.changeLogs[index % recorded.changeLogs.length],
            createdAt: `2026-10-22T10:00:${String(index % 60).padStart(2, '0')}.000`,
        })),
    })

    it("asks for one program's attribute changelog newest first, 100 at a time", async () => {
        const { engine, requests } = await engineAnswering(ATTRIBUTES, recorded)

        const result = await fetchAttributeChangeLog(engine, {
            trackedEntity: 'TlE2eTei001',
            program: 'WSGAb5XwJ3Y',
        })

        expect(requests).toEqual([
            {
                resource: ATTRIBUTES,
                params: {
                    program: 'WSGAb5XwJ3Y',
                    order: 'createdAt:desc',
                    page: 1,
                    pageSize: 100,
                },
            },
        ])
        expect(result.rows).toHaveLength(7)
        expect(result).toMatchObject({ truncated: false, unsupported: false })
    })

    it('reads pages until a short one, counting unknown rows toward a full page', async () => {
        const full = rowsOf(100)
        full.changeLogs[0] = {
            ...full.changeLogs[0],
            change: { somethingNew: { id: 'x' } },
        }
        const { engine, requests } = await engineAnswering(
            ATTRIBUTES,
            full,
            rowsOf(3)
        )

        const result = await fetchAttributeChangeLog(engine, {
            trackedEntity: 'TlE2eTei001',
            program: 'p',
        })

        expect(requests).toHaveLength(2)
        expect(requests[1]?.params?.page).toBe(2)
        expect(result.rows).toHaveLength(102)
    })

    it('asks once more when exactly 500 rows came on full pages, and is not truncated', async () => {
        const { engine, requests } = await engineAnswering(
            EVENT,
            ...Array.from({ length: 5 }, () => rowsOf(100)),
            { changeLogs: [] }
        )

        const result = await fetchEventChangeLog(engine, {
            event: 'TlE2eEvt004',
        })

        expect(requests).toHaveLength(6)
        expect(result.rows).toHaveLength(500)
        expect(result.truncated).toBe(false)
    })

    it('stops past 500 rows and says the rest were left out', async () => {
        const { engine, requests } = await engineAnswering(
            EVENT,
            ...Array.from({ length: 6 }, () => rowsOf(100))
        )

        const result = await fetchEventChangeLog(engine, {
            event: 'TlE2eEvt004',
        })

        expect(requests[0]).toEqual({
            resource: EVENT,
            params: { order: 'createdAt:desc', page: 1, pageSize: 100 },
        })
        expect(requests).toHaveLength(6)
        expect(result.rows).toHaveLength(500)
        expect(result.truncated).toBe(true)
    })

    it.each([
        { name: 'in the JSON body', error: failure(404) },
        {
            name: 'only in the message, when the body was not JSON',
            error: new FetchError({
                type: 'unknown',
                message: 'An unknown error occurred - Not Found (404)',
                details: {},
            }),
        },
    ])(
        'answers "unsupported", not a failure, on a 404 with its status $name',
        async ({ error }) => {
            const { engine } = await engineAnswering(EVENT, error)

            const result = await fetchEventChangeLog(engine, {
                event: 'TlE2eEvt004',
            })

            expect(result).toEqual({
                rows: [],
                truncated: false,
                unsupported: true,
            })
        }
    )

    it('fails on any other error', async () => {
        const network = new FetchError({
            type: 'network',
            message: 'An unknown network error occurred',
            details: {},
        })
        const first = await engineAnswering(EVENT, network)
        await expect(
            fetchEventChangeLog(first.engine, { event: 'TlE2eEvt004' })
        ).rejects.toBe(network)

        const second = await engineAnswering(EVENT, failure(500))
        await expect(
            fetchEventChangeLog(second.engine, { event: 'TlE2eEvt004' })
        ).rejects.toThrow('(500)')
    })
})

describe('fetchProgramTimelineMetadata', () => {
    it('asks for stages, report flags, due-date visibility and attributes', async () => {
        const { engine, requests } = await engineAnswering(
            'programs',
            BodySchema.parse(programMetadata)
        )

        const result = await fetchProgramTimelineMetadata(engine, {
            program: 'WSGAb5XwJ3Y',
        })

        const [request] = requests
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
        expect(result.id).toBe('WSGAb5XwJ3Y')
    })
})

describe('fetchOrgUnitNames', () => {
    it('asks for org unit names in one request for all ids', async () => {
        const { engine, requests } = await engineAnswering(
            'organisationUnits',
            BodySchema.parse(orgUnitNames)
        )

        const result = await fetchOrgUnitNames(engine, {
            ids: ['DiszpKrYNg8', 'ImspTQPwCqd'],
        })

        expect(requests).toEqual([
            {
                resource: 'organisationUnits',
                params: {
                    filter: 'id:in:[DiszpKrYNg8,ImspTQPwCqd]',
                    fields: 'id,displayName',
                    paging: false,
                },
            },
        ])
        expect(result).toContainEqual({
            id: 'ImspTQPwCqd',
            displayName: 'Sierra Leone',
        })
    })

    it('makes no request for no ids', async () => {
        const { engine, requests } = await engineAnswering('organisationUnits')

        const result = await fetchOrgUnitNames(engine, { ids: [] })

        expect(requests).toHaveLength(0)
        expect(result).toEqual([])
    })
})

describe('errors', () => {
    it('throws on an HTTP failure and on a response of another shape', async () => {
        const failing = await engineAnswering('tracker/events', failure(400))
        await expect(
            fetchEvents(failing.engine, {
                trackedEntity: 'te1',
                program: 'p1',
                timeField: 'occurredAt',
                cap: 3,
            })
        ).rejects.toThrow('(400)')

        const { engine } = await engineAnswering('tracker/trackedEntities', {
            unexpected: true,
        })
        await expect(
            fetchTrackedEntity(engine, { trackedEntity: 'te1' })
        ).rejects.toThrow(z.ZodError)
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
