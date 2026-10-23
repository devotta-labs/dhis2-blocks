import { CustomDataProvider } from '@dhis2/app-runtime'
import {
    keepPreviousData,
    QueryClient,
    QueryClientProvider,
} from '@tanstack/react-query'
import React, { Component, type ComponentProps, type ReactNode } from 'react'
import { render } from 'vitest-browser-react'
import { z } from 'zod'
import {
    TrackedEntityRecordProvider,
    useTrackedEntityRecord,
    type JsonValue,
    type TrackedEntityRecord,
    type TrackedEntityRecordContextValue,
} from '..'
import orgUnitPaths from './fixtures/v42/org-unit-paths.json'
import personMissing from './fixtures/v42/person-missing.status.json'
import personP1 from './fixtures/v42/person-P1.json'
import personP2 from './fixtures/v42/person-P2.json'
import personP3 from './fixtures/v42/person-P3.json'
import programs from './fixtures/v42/programs.json'
import relationshipTypes from './fixtures/v42/relationship-types.json'
import relationshipsP1 from './fixtures/v42/relationships-P1.json'
import trackedEntityType from './fixtures/v42/tracked-entity-type.json'
import userScopes from './fixtures/v42/user-scopes.json'

// The provider against a fake server: app-runtime's CustomDataProvider serves
// the recorded v42 fixtures through the real data engine (no module mocks).

const P1 = 'TrE2eTei001'
const P2 = 'TrE2eTei002'
const P3 = 'TrE2eTei003'
const MISSING = 'TrE2eMis001'
const PRG_OPEN = 'TrE2ePrg001'
const PRG_ONCE = 'TrE2ePrg002'
const PRG_PROTECTED = 'TrE2ePrg003'

const PERSON = 'tracker/trackedEntities'
const RESOURCES = [
    PERSON,
    'trackedEntityTypes',
    'programs',
    'tracker/relationships',
    'relationshipTypes',
    'me',
    'organisationUnits',
] as const
type Resource = (typeof RESOURCES)[number]

const WAIT = { timeout: 5000 }

/** The part of the engine's resolved query the fake server reads. */
interface EngineQuery {
    id?: string
}
type Handler = (query: EngineQuery) => Promise<JsonValue>

/** Fixtures are served as the JSON they are. */
const Json = z.json()

const RelationshipsQuerySchema = z.object({
    params: z.object({ trackedEntity: z.string() }),
})

/** What the data engine rejects with for an HTTP error answer. */
const httpError = (status: number, message = `Server answered ${status}`) =>
    Object.assign(new Error(message), {
        details: { httpStatusCode: status, message },
    })

const notFoundMessage = (id: string) =>
    `TrackedEntity with id ${id} could not be found.`

const PERSONS = new Map<string, JsonValue>([
    [P1, Json.parse(personP1)],
    [P2, Json.parse(personP2)],
    [P3, Json.parse(personP3)],
])

const defaultHandlers = (): Map<Resource, Handler> =>
    new Map<Resource, Handler>([
        [
            PERSON,
            async ({ id = '' }) => {
                const person = PERSONS.get(id)
                if (person === undefined) {
                    throw httpError(404, notFoundMessage(id))
                }
                return person
            },
        ],
        ['trackedEntityTypes', async () => Json.parse(trackedEntityType)],
        ['programs', async () => Json.parse(programs)],
        [
            'tracker/relationships',
            async (query) =>
                RelationshipsQuerySchema.parse(query).params.trackedEntity ===
                P1
                    ? Json.parse(relationshipsP1)
                    : { relationships: [] },
        ],
        ['relationshipTypes', async () => Json.parse(relationshipTypes)],
        ['me', async () => Json.parse(userScopes)],
        ['organisationUnits', async () => Json.parse(orgUnitPaths)],
    ])

type CustomData = ComponentProps<typeof CustomDataProvider>['data']

const createServer = () => {
    const calls = new Map<Resource, number>()
    let handlers = defaultHandlers()
    const data: CustomData = Object.fromEntries(
        RESOURCES.map((resource) => [
            resource,
            async (_type: string, query: EngineQuery) => {
                calls.set(resource, (calls.get(resource) ?? 0) + 1)
                const handler = handlers.get(resource)
                if (!handler) throw new Error(`No handler for ${resource}`)
                return handler(query)
            },
        ])
    )
    return {
        data,
        calls: (resource: Resource) => calls.get(resource) ?? 0,
        handle: (resource: Resource, handler: Handler) => {
            handlers.set(resource, handler)
        },
        reset: () => {
            handlers = defaultHandlers()
        },
    }
}
type FakeServer = ReturnType<typeof createServer>

interface RecordProps {
    trackedEntityId: string
    programs?: readonly string[]
}

/** Renders the provider under a fresh query client; records every value seen. */
const testQueryClient = () =>
    new QueryClient({
        defaultOptions: { queries: { retry: false, retryDelay: 0 } },
    })

const setup = (server: FakeServer, queryClient = testQueryClient()) => {
    const seen: TrackedEntityRecordContextValue[] = []
    const Probe = () => {
        seen.push(useTrackedEntityRecord())
        return null
    }
    const ui = (props: RecordProps) => (
        <CustomDataProvider data={server.data}>
            <QueryClientProvider client={queryClient}>
                <TrackedEntityRecordProvider
                    trackedEntityId={props.trackedEntityId}
                    programs={props.programs}
                >
                    <Probe />
                </TrackedEntityRecordProvider>
            </QueryClientProvider>
        </CustomDataProvider>
    )
    const latest = () => {
        const value = seen.at(-1)
        if (!value) throw new Error('The provider has not rendered yet')
        return value
    }
    return { seen, ui, latest }
}
type View = ReturnType<typeof setup>

const waitForReady = (view: View, id?: string) =>
    vi.waitFor((): TrackedEntityRecord => {
        const { state } = view.latest()
        if (state.status !== 'ready') {
            throw new Error(`The state is ${state.status}`)
        }
        if (id !== undefined && state.record.person.id !== id) {
            throw new Error(`The record is ${state.record.person.id}`)
        }
        return state.record
    }, WAIT)

const statusesSince = (view: View, from: number) =>
    view.seen.slice(from).map(({ state }) => state.status)

/** Review Focus 1: after P1 → P2, no render shows P1's record. */
const expectNoPreviousPerson = async (view: View) => {
    const screen = await render(view.ui({ trackedEntityId: P1 }))
    await waitForReady(view, P1)
    const changedAt = view.seen.length

    await screen.rerender(view.ui({ trackedEntityId: P2 }))
    expect((await waitForReady(view, P2)).person.id).toBe(P2)

    const afterChange = view.seen.slice(changedAt)
    expect(afterChange.length).toBeGreaterThan(0)
    expect(
        afterChange.some(
            ({ state }) =>
                state.status === 'ready' && state.record.person.id === P1
        )
    ).toBe(false)
    expect(afterChange[0]?.state).toEqual({ status: 'pending' })
    expect(afterChange.every(({ meta }) => meta.trackedEntityId === P2)).toBe(
        true
    )
}

describe('TrackedEntityRecordProvider', () => {
    it('goes from pending to ready with P1', async () => {
        const server = createServer()
        const view = setup(server)
        await render(view.ui({ trackedEntityId: P1 }))

        expect(view.seen[0]?.state).toEqual({ status: 'pending' })
        const record = await waitForReady(view)

        expect(record.person.id).toBe(P1)
        expect(view.latest().meta.trackedEntityId).toBe(P1)
        // No programs prop: every program with an enrollment or owner, by name.
        expect([...record.programs.keys()]).toEqual([
            PRG_ONCE,
            PRG_OPEN,
            PRG_PROTECTED,
        ])
        expect(record.programs.get(PRG_OPEN)?.status).toBe('enrolled')
        // Owned outside the capture scope: resolved with the scope lookups.
        expect(record.programs.get(PRG_PROTECTED)).toMatchObject({
            status: 'unavailable',
            debug: expect.stringContaining('outside'),
        })
        expect(server.calls('me')).toBe(1)
        expect(server.calls('organisationUnits')).toBe(1)
        // Never an intermediate unavailable or error while lookups ran, and
        // no record built before they answered ("not loaded" would read as
        // unavailable for the wrong reason).
        expect(new Set(statusesSince(view, 0))).toEqual(
            new Set(['pending', 'ready'])
        )
        const protectedStates = view.seen.flatMap(({ state }) =>
            state.status === 'ready'
                ? [state.record.programs.get(PRG_PROTECTED)]
                : []
        )
        expect(protectedStates.length).toBeGreaterThan(0)
        for (const programState of protectedStates) {
            expect(programState).toMatchObject({
                debug: expect.stringContaining('outside'),
            })
        }
        await vi.waitFor(() => {
            const { state } = view.latest()
            expect(
                state.status === 'ready' && state.record.relationships
            ).toMatchObject({ status: 'ready', relationships: [{}] })
        }, WAIT)
    })

    it('is unavailable for a missing person, with the server message in debug', async () => {
        const server = createServer()
        const view = setup(server)
        await render(view.ui({ trackedEntityId: MISSING }))

        await vi.waitFor(() => {
            expect(view.latest().state).toEqual({
                status: 'unavailable',
                debug: personMissing.body.message,
            })
        }, WAIT)
        expect(server.calls(PERSON)).toBe(1)
    })

    it('is error with a working retry on a 500', async () => {
        const server = createServer()
        server.handle(PERSON, async () => {
            throw httpError(500)
        })
        const view = setup(server)
        await render(view.ui({ trackedEntityId: P1 }))

        const state = await vi.waitFor(() => {
            const current = view.latest().state
            if (current.status !== 'error') throw new Error(current.status)
            return current
        }, WAIT)
        expect(state.error).toBeInstanceOf(Error)
        // A 5xx is retried twice before it shows.
        expect(server.calls(PERSON)).toBe(3)

        server.reset()
        state.retry()
        expect((await waitForReady(view)).person.id).toBe(P1)
    })

    it('is error when the tracked entity type request fails', async () => {
        const server = createServer()
        server.handle('trackedEntityTypes', async () => {
            throw httpError(500)
        })
        const view = setup(server)
        await render(view.ui({ trackedEntityId: P1 }))

        const state = await vi.waitFor(() => {
            const current = view.latest().state
            if (current.status !== 'error') throw new Error(current.status)
            return current
        }, WAIT)
        expect(state.error).toBeInstanceOf(Error)

        server.reset()
        state.retry()
        expect((await waitForReady(view)).person.id).toBe(P1)
    })

    it('orders programs as the programs prop lists them', async () => {
        const server = createServer()
        const view = setup(server)
        await render(
            view.ui({
                trackedEntityId: P1,
                programs: [PRG_PROTECTED, PRG_OPEN, PRG_ONCE],
            })
        )

        const record = await waitForReady(view)
        expect([...record.programs.keys()]).toEqual([
            PRG_PROTECTED,
            PRG_OPEN,
            PRG_ONCE,
        ])
        expect(record.programs.get(PRG_PROTECTED)?.status).toBe('unavailable')
        expect(record.programs.get(PRG_ONCE)?.status).toBe('enrolled')
    })

    it('makes every program error when the programs request fails, and the person stays ready', async () => {
        const server = createServer()
        server.handle('programs', async () => {
            throw httpError(500)
        })
        const view = setup(server)
        await render(view.ui({ trackedEntityId: P1 }))

        const record = await waitForReady(view)
        expect(record.person.id).toBe(P1)
        const states = [...record.programs.values()]
        expect(states).toHaveLength(3)
        expect(states.map(({ status }) => status)).toEqual([
            'error',
            'error',
            'error',
        ])
        // Owners can't be checked without metadata: no scope lookups.
        expect(server.calls('me')).toBe(0)

        server.reset()
        const failed = record.programs.get(PRG_OPEN)
        if (failed?.status !== 'error') throw new Error('expected error')
        failed.retry()
        await vi.waitFor(() => {
            const { state } = view.latest()
            expect(
                state.status === 'ready' &&
                    state.record.programs.get(PRG_OPEN)?.status
            ).toBe('enrolled')
        }, WAIT)
    })

    it('keeps the record shown with isFetching during refresh, then shows the new data', async () => {
        const server = createServer()
        const view = setup(server)
        await render(view.ui({ trackedEntityId: P1 }))
        const first = await waitForReady(view)
        const shownFrom = view.seen.length

        const gate = Promise.withResolvers<void>()
        const updatedAt = '2030-01-01T00:00:00.000'
        server.handle(PERSON, async () => {
            await gate.promise
            return Json.parse({ ...personP1, updatedAt })
        })
        const refreshing = view.latest().actions.refresh()

        await vi.waitFor(() => {
            expect(view.latest().meta.isFetching).toBe(true)
        }, WAIT)
        expect(view.latest().state).toEqual({ status: 'ready', record: first })

        gate.resolve()
        await refreshing
        await vi.waitFor(() => {
            const { state } = view.latest()
            expect(
                state.status === 'ready' && state.record.person.updatedAt
            ).toBe(updatedAt)
        }, WAIT)
        await vi.waitFor(() => {
            expect(view.latest().meta.isFetching).toBe(false)
        }, WAIT)
        expect(new Set(statusesSince(view, shownFrom))).toEqual(
            new Set(['ready'])
        )
    })

    it('replaces the record with unavailable when a refresh answers 404', async () => {
        const server = createServer()
        const view = setup(server)
        await render(view.ui({ trackedEntityId: P1 }))
        await waitForReady(view)

        server.handle(PERSON, async () => {
            throw httpError(404, notFoundMessage(P1))
        })
        await expect(view.latest().actions.refresh()).rejects.toThrow()

        await vi.waitFor(() => {
            expect(view.latest().state).toEqual({
                status: 'unavailable',
                debug: notFoundMessage(P1),
            })
        }, WAIT)
    })

    it('keeps the record when a refresh fails with 500, and refresh() rejects', async () => {
        const server = createServer()
        const view = setup(server)
        await render(view.ui({ trackedEntityId: P1 }))
        await waitForReady(view)
        const shownFrom = view.seen.length

        server.handle(PERSON, async () => {
            throw httpError(500)
        })
        await expect(view.latest().actions.refresh()).rejects.toThrow()

        expect(server.calls(PERSON)).toBe(4)
        expect((await waitForReady(view)).person.id).toBe(P1)
        expect(new Set(statusesSince(view, shownFrom))).toEqual(
            new Set(['ready'])
        )
    })

    it('relationships failing do not block the record', async () => {
        const server = createServer()
        server.handle('tracker/relationships', async () => {
            throw httpError(500)
        })
        const view = setup(server)
        await render(view.ui({ trackedEntityId: P1 }))

        expect((await waitForReady(view)).person.id).toBe(P1)
        await vi.waitFor(() => {
            const { state } = view.latest()
            expect(
                state.status === 'ready' && state.record.relationships.status
            ).toBe('error')
        }, WAIT)
    })

    it('does not show the previous person after the id changes', async () => {
        await expectNoPreviousPerson(setup(createServer()))
    })

    it('does not show the previous person after the id changes when the host keeps previous data', async () => {
        const queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                    retryDelay: 0,
                    placeholderData: keepPreviousData,
                },
            },
        })
        await expectNoPreviousPerson(setup(createServer(), queryClient))
    })

    it('is ready with no programs when the person has no visible enrollments', async () => {
        const server = createServer()
        server.handle(PERSON, async () =>
            Json.parse({ ...personP3, programOwners: [] })
        )
        const view = setup(server)
        await render(view.ui({ trackedEntityId: P3 }))

        const record = await waitForReady(view)
        expect(record.programs.size).toBe(0)
        expect(server.calls('programs')).toBe(0)
        expect(server.calls('me')).toBe(0)
    })

    it('keeps one programs query when the programs prop is a new array with the same ids', async () => {
        const server = createServer()
        const view = setup(server)
        const screen = await render(
            view.ui({ trackedEntityId: P1, programs: [PRG_OPEN, PRG_ONCE] })
        )
        await waitForReady(view)

        for (let round = 0; round < 5; round += 1) {
            await screen.rerender(
                view.ui({
                    trackedEntityId: P1,
                    programs: [PRG_OPEN, PRG_ONCE],
                })
            )
        }

        const record = await waitForReady(view)
        expect([...record.programs.keys()]).toEqual([PRG_OPEN, PRG_ONCE])
        expect(server.calls('programs')).toBe(1)
    })

    it('makes no scope requests when no program needs a scope check', async () => {
        const server = createServer()
        const view = setup(server)
        await render(view.ui({ trackedEntityId: P2 }))

        const record = await waitForReady(view)
        expect(record.programs.get(PRG_OPEN)?.status).toBe('enrolled')
        expect(server.calls('me')).toBe(0)
        expect(server.calls('organisationUnits')).toBe(0)
    })

    it('useTrackedEntityRecord throws outside the provider', async () => {
        const consoleError = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined)
        const caught: Error[] = []
        const Consumer = () => {
            useTrackedEntityRecord()
            return null
        }
        await render(
            <Boundary onError={(error) => caught.push(error)}>
                <Consumer />
            </Boundary>
        )

        await vi.waitFor(() => {
            expect(caught[0]?.message).toMatch(/TrackedEntityRecordProvider/)
        }, WAIT)
        consoleError.mockRestore()
    })
})

interface BoundaryProps {
    children: ReactNode
    onError: (error: Error) => void
}

interface BoundaryState {
    failed: boolean
}

class Boundary extends Component<BoundaryProps, BoundaryState> {
    state: BoundaryState = { failed: false }

    static getDerivedStateFromError(): BoundaryState {
        return { failed: true }
    }

    componentDidCatch(error: Error) {
        this.props.onError(error)
    }

    render() {
        return this.state.failed ? null : this.props.children
    }
}
