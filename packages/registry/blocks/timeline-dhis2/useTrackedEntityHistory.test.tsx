import { CustomDataProvider } from '@dhis2/app-runtime'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { type ComponentProps, type ReactNode } from 'react'
import { renderHook } from 'vitest-browser-react'
import { z } from 'zod'
import { NOW, notFound } from './__tests__/fixtures/renderEntries'
import changelog from './__tests__/fixtures/v43/tracked-entity-changelog.json'
import page1 from './__tests__/fixtures/v43/events-page-1.json'
import page2 from './__tests__/fixtures/v43/events-page-2.json'
import orgUnitNames from './__tests__/fixtures/v43/org-unit-names.json'
import programMetadata from './__tests__/fixtures/v43/program-metadata.json'
import trackedEntity from './__tests__/fixtures/v43/tracked-entity.json'
import { timelineKeys } from './timelineKeys'
import { useTrackedEntityHistory } from './useTrackedEntityHistory'

type CustomData = ComponentProps<typeof CustomDataProvider>['data']
type Json = z.infer<ReturnType<typeof z.json>>

const TE = 'TlE2eTei001'
const ANC = 'WSGAb5XwJ3Y'
const TB = 'TlE2eTbPrg1'

const JsonObject = z.record(z.string(), z.json())
const ChangeLogs = z.object({ changeLogs: z.array(JsonObject) })

const ancEvents = [
    ...z.object({ events: z.array(JsonObject) }).parse(page1).events,
    ...z.object({ events: z.array(JsonObject) }).parse(page2).events,
]

const tbEvent = {
    event: 'TlE2eTbEvt1',
    status: 'COMPLETED',
    program: TB,
    programStage: 'TlE2eTbStg1',
    orgUnit: 'DiszpKrYNg8',
    occurredAt: '2026-09-01T00:00:00.000',
    dataValues: [],
    notes: [],
}

const tbMetadata = {
    id: TB,
    displayName: 'TB program',
    programStages: [
        {
            id: 'TlE2eTbStg1',
            displayName: 'TB visit',
            programStageDataElements: [],
        },
    ],
    programTrackedEntityAttributes: [],
}

const ancChanges = ChangeLogs.parse(changelog).changeLogs
// The type's attributes come back in every program's changelog.
const tbChanges = [
    ancChanges[0],
    {
        ...ancChanges[0],
        createdAt: '2026-10-01T08:00:00.000',
        change: {
            attributeValue: { attribute: 'TlE2eTbAtt1', currentValue: 'x' },
        },
    },
]

const entityWithTb = {
    ...JsonObject.parse(trackedEntity),
    enrollments: [
        ...z.object({ enrollments: z.array(JsonObject) }).parse(trackedEntity)
            .enrollments,
        {
            enrollment: 'TlE2eTbEnr1',
            program: TB,
            status: 'ACTIVE',
            enrolledAt: '2026-08-15T00:00:00.000',
            notes: [],
        },
    ],
}

interface Server {
    entity?: Error
    /** Called on each events request; a thrown error fails it. */
    onEvents?: (program: string) => void
    /** Enrollments added to the record. */
    extraEnrollments?: Json[]
    /** Events per program, or an error to throw. */
    events?: Record<string, Json[] | Error>
    changelogs?: Record<string, Json[] | Error>
    /** Holds every changelog request until it settles. */
    changesGate?: Promise<void>
}

const setup = (server: Server = {}) => {
    const requests: string[] = []
    const answer = (
        value: Json[] | Error | undefined,
        wrap: (rows: Json[]) => Json
    ) => {
        if (value instanceof Error) {
            throw value
        }
        return wrap(value ?? [])
    }
    const data: CustomData = {
        'tracker/trackedEntities': async () => {
            requests.push('trackedEntity')
            if (server.entity !== undefined) {
                throw server.entity
            }
            return {
                ...entityWithTb,
                enrollments: [
                    ...entityWithTb.enrollments,
                    ...(server.extraEnrollments ?? []),
                ],
            }
        },
        'tracker/events': async (_type, query) => {
            const program = String(query.params?.program)
            requests.push(`events:${program}`)
            // A moment on the wire, so a test can see the state in between.
            await new Promise((resolve) => setTimeout(resolve, 30))
            server.onEvents?.(program)
            const pageSize = Number(query.params?.pageSize)
            const events =
                server.events?.[program] ??
                (program === ANC ? ancEvents : [tbEvent])
            return answer(events, (rows) => ({
                events: rows.slice(0, pageSize),
            }))
        },
        [`tracker/trackedEntities/${TE}/changeLogs`]: async (_type, query) => {
            const program = String(query.params?.program)
            requests.push(`changes:${program}`)
            await server.changesGate
            const rows =
                server.changelogs?.[program] ??
                (program === ANC ? ancChanges : tbChanges)
            return answer(rows, (list) => ({ changeLogs: list }))
        },
        programs: async (_type, query) => {
            requests.push(`metadata:${String(query.id)}`)
            if (query.id === ANC) {
                return JsonObject.parse(programMetadata)
            }
            return { ...tbMetadata, id: String(query.id) }
        },
        organisationUnits: async () => {
            requests.push('orgUnits')
            return JsonObject.parse(orgUnitNames)
        },
    }
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    const wrapper = ({ children }: { children: ReactNode }) => (
        <CustomDataProvider data={data}>
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </CustomDataProvider>
    )
    return { wrapper, requests, queryClient }
}

const renderHistory = (
    server: Server = {},
    options: { programs?: string[]; cap?: number } = {}
) => {
    const { wrapper, requests, queryClient } = setup(server)
    /** Every render's status and entry count, to catch states in between. */
    const renders: Array<{ status: string; count: number }> = []
    return renderHook(
        () => {
            const history = useTrackedEntityHistory({
                trackedEntity: TE,
                timeField: 'occurredAt',
                now: NOW,
                ...options,
            })
            renders.push({
                status: history.status,
                count: history.entries.length,
            })
            return history
        },
        { wrapper }
    ).then((rendered) => ({ ...rendered, requests, queryClient, renders }))
}

const kinds = (entries: ReadonlyArray<{ data: { kind: string } }>) =>
    [...new Set(entries.map((entry) => entry.data.kind))].sort()

describe('useTrackedEntityHistory', () => {
    it('covers every enrolled program, with names resolved, once every request has answered', async () => {
        const { result, requests } = await renderHistory()

        expect(result.current.status).toBe('pending')
        expect(result.current.entries).toEqual([])
        await expect.poll(() => result.current.status).toBe('success')

        const { entries } = result.current
        expect(kinds(entries)).toEqual(['change', 'event', 'milestone', 'note'])
        const tb = entries.find((entry) => entry.id === 'event:TlE2eTbEvt1')
        expect(tb?.data).toMatchObject({
            kind: 'event',
            program: { name: 'TB program' },
            stage: { name: 'TB visit' },
            orgUnitName: 'Ngelehun CHC',
        })
        expect(
            entries.some(
                (entry) => entry.id === 'milestone:TlE2eTbEnr1:enrolled'
            )
        ).toBe(true)
        // 2.43 requires program on events: one request per program.
        expect(requests.filter((r) => r.startsWith('events:')).sort()).toEqual(
            [`events:${TB}`, `events:${ANC}`].sort()
        )
        expect(requests.filter((r) => r === 'orgUnits')).toHaveLength(1)
        expect(result.current.notices).toEqual([])
    })

    it("keeps a save shared by two programs' changelogs once", async () => {
        const { result } = await renderHistory()
        await expect.poll(() => result.current.status).toBe('success')

        const saves = result.current.entries.flatMap((entry) =>
            entry.data.kind === 'change' ? [entry.data.save] : []
        )
        const ids = saves.map((save) => save.id)
        expect(new Set(ids).size).toBe(ids.length)
        const fields = saves.flatMap((save) =>
            save.changes.map((change) => `${save.id}:${change.field.id}`)
        )
        expect(new Set(fields).size).toBe(fields.length)
        expect(fields.some((field) => field.endsWith('TlE2eTbAtt1'))).toBe(true)
    })

    it('shows events and enrollments without waiting for the changes, adding them when they arrive', async () => {
        let release: () => void = () => undefined
        const changesGate = new Promise<void>((resolve) => {
            release = resolve
        })
        const { result, renders } = await renderHistory({ changesGate })
        await expect.poll(() => result.current.status).toBe('success')

        expect(kinds(result.current.entries)).toEqual([
            'event',
            'milestone',
            'note',
        ])
        expect(result.current.isFetching).toBe(true)
        const shown = result.current.entries.length
        const from = renders.length

        release()
        await expect
            .poll(() => kinds(result.current.entries))
            .toEqual(['change', 'event', 'milestone', 'note'])
        const during = renders.slice(from)
        expect(during.every((render) => render.status === 'success')).toBe(true)
        expect(during.every((render) => render.count >= shown)).toBe(true)
    })

    it('takes only the given programs', async () => {
        const { result, requests } = await renderHistory(
            {},
            { programs: [ANC] }
        )
        await expect.poll(() => result.current.status).toBe('success')

        expect(requests).not.toContain(`events:${TB}`)
        expect(
            result.current.entries.some((entry) => entry.id.includes('TlE2eTb'))
        ).toBe(false)
    })

    it('shows the rest and a notice with retry when one program fails', async () => {
        const { result } = await renderHistory({
            events: { [TB]: new Error('boom') },
        })
        await expect.poll(() => result.current.status).toBe('success')

        expect(
            result.current.entries.some((entry) =>
                entry.id.startsWith('event:TlE2eEvt')
            )
        ).toBe(true)
        const notice = result.current.notices.find(
            (candidate) => candidate.id === `events-failed:${TB}`
        )
        expect(notice).toMatchObject({
            tone: 'error',
            message: "Events in TB program couldn't load.",
        })
        expect(notice?.retry).toBeInstanceOf(Function)
    })

    it('keeps the history on show while a failed program is retried', async () => {
        let tbFails = true
        const { result, renders } = await renderHistory({
            onEvents: (program) => {
                if (program === TB && tbFails) {
                    throw new Error('boom')
                }
            },
        })
        await expect.poll(() => result.current.status).toBe('success')
        const shown = result.current.entries.length
        const notice = result.current.notices.find(
            (candidate) => candidate.id === `events-failed:${TB}`
        )
        const from = renders.length

        tbFails = false
        notice?.retry?.()
        await expect
            .poll(() =>
                result.current.entries.some(
                    (entry) => entry.id === 'event:TlE2eTbEvt1'
                )
            )
            .toBe(true)

        // Never back to pending or to fewer entries while the retry ran.
        const during = renders.slice(from)
        expect(during.length).toBeGreaterThan(1)
        expect(during.every((render) => render.status === 'success')).toBe(true)
        expect(during.every((render) => render.count >= shown)).toBe(true)
        expect(
            result.current.notices.some(
                (candidate) => candidate.id === `events-failed:${TB}`
            )
        ).toBe(false)
    })

    it('adds a program enrolled after the first load without emptying the history', async () => {
        const server: Server = {}
        const { result, queryClient, renders } = await renderHistory(server)
        await expect.poll(() => result.current.status).toBe('success')
        const shown = result.current.entries.length
        const from = renders.length

        server.extraEnrollments = [
            {
                enrollment: 'TlE2eNewEnr',
                program: 'TlE2eNewPrg',
                status: 'ACTIVE',
                enrolledAt: '2026-10-01T00:00:00.000',
                notes: [],
            },
        ]
        void queryClient.invalidateQueries({ queryKey: timelineKeys.root })
        await expect
            .poll(() =>
                result.current.entries.some(
                    (entry) => entry.id === 'milestone:TlE2eNewEnr:enrolled'
                )
            )
            .toBe(true)

        const during = renders.slice(from)
        expect(during.every((render) => render.status === 'success')).toBe(true)
        expect(during.every((render) => render.count >= shown)).toBe(true)
        const added = result.current.entries.find(
            (entry) => entry.id === 'milestone:TlE2eNewEnr:enrolled'
        )
        // Shown only once its program's metadata has answered.
        expect(added?.data).toMatchObject({ program: { id: 'TlE2eNewPrg' } })
    })

    it('is an error, with the enrollments notice, when the tracked entity fails', async () => {
        const { result } = await renderHistory({ entity: new Error('down') })
        await expect.poll(() => result.current.status).toBe('error')

        expect(result.current.entries).toEqual([])
        expect(result.current.notices.map((notice) => notice.id)).toEqual([
            'enrollments-failed',
        ])
    })

    it('says changes are unsupported on a 404, without failing the history', async () => {
        const { result } = await renderHistory({
            changelogs: { [ANC]: notFound(), [TB]: notFound() },
        })
        await expect.poll(() => result.current.status).toBe('success')

        expect(result.current.notices.map((notice) => notice.id)).toEqual([
            'changes-unsupported',
        ])
        expect(kinds(result.current.entries)).toEqual([
            'event',
            'milestone',
            'note',
        ])
    })

    it('says when a program has more events than the cap', async () => {
        const { result } = await renderHistory({}, { cap: 2 })
        await expect.poll(() => result.current.status).toBe('success')

        expect(result.current.notices).toContainEqual(
            expect.objectContaining({
                id: `events-capped:${ANC}`,
                tone: 'info',
            })
        )
        expect(
            result.current.entries.filter(
                (entry) =>
                    entry.data.kind === 'event' &&
                    entry.data.program?.id === ANC
            )
        ).toHaveLength(2)
    })

    it('refreshes on refetch and on invalidating timelineKeys.root, keeping entries meanwhile', async () => {
        const { result, requests, queryClient } = await renderHistory()
        await expect.poll(() => result.current.status).toBe('success')
        const before = requests.length

        result.current.refetch()
        expect(result.current.entries.length).toBeGreaterThan(0)
        await expect.poll(() => requests.length).toBeGreaterThan(before)
        await expect.poll(() => result.current.isFetching).toBe(false)
        // Three hooks share the tracked entity: one request, none cancelled.
        expect(
            requests.slice(before).filter((r) => r === 'trackedEntity')
        ).toHaveLength(1)

        const again = requests.length
        await queryClient.invalidateQueries({ queryKey: timelineKeys.root })
        expect(requests.length).toBeGreaterThan(again)
        expect(result.current.status).toBe('success')
    })
})
