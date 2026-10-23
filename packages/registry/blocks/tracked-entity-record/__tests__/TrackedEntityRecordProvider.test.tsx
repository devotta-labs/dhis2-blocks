import { keepPreviousData, QueryClient } from '@tanstack/react-query'
import React, { Component, type ReactNode } from 'react'
import { render } from 'vitest-browser-react'
import { useTrackedEntityRecord } from '..'
import personMissing from './fixtures/v42/person-missing.status.json'
import personP1 from './fixtures/v42/person-P1.json'
import personP3 from './fixtures/v42/person-P3.json'
import programs from './fixtures/v42/programs.json'
import {
    createServer,
    expectNoPreviousPerson,
    httpError,
    Json,
    MISSING,
    notFoundMessage,
    P1,
    P2,
    P3,
    PERSON,
    PRG_ONCE,
    PRG_OPEN,
    PRG_PROTECTED,
    setup,
    statusesSince,
    WAIT,
    waitForReady,
} from './recordServer'

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

    it('refresh() resolves when only the relationships refetch fails', async () => {
        const server = createServer()
        const view = setup(server)
        await render(view.ui({ trackedEntityId: P1 }))
        await waitForReady(view)
        const personCalls = server.calls(PERSON)
        const relationshipCalls = server.calls('tracker/relationships')

        server.handle('tracker/relationships', async () => {
            throw httpError(500)
        })
        await expect(view.latest().actions.refresh()).resolves.toBeUndefined()

        // Both refetched (relationships with their 5xx retries); the record
        // stays ready with the relationships it had.
        expect(server.calls(PERSON)).toBe(personCalls + 1)
        expect(server.calls('tracker/relationships')).toBe(
            relationshipCalls + 3
        )
        const { state } = view.latest()
        expect(
            state.status === 'ready' && state.record.relationships.status
        ).toBe('ready')
    })

    it('does not show the old program set after the programs prop changes', async () => {
        const server = createServer()
        const view = setup(server)
        const screen = await render(
            view.ui({ trackedEntityId: P1, programs: [PRG_OPEN] })
        )
        expect([...(await waitForReady(view)).programs.keys()]).toEqual([
            PRG_OPEN,
        ])
        const changedAt = view.seen.length

        const gate = Promise.withResolvers<void>()
        server.handle('programs', async () => {
            await gate.promise
            return Json.parse(programs)
        })
        await screen.rerender(
            view.ui({ trackedEntityId: P1, programs: [PRG_ONCE, PRG_OPEN] })
        )
        await vi.waitFor(() => {
            expect(view.latest().state).toEqual({ status: 'pending' })
        }, WAIT)

        gate.resolve()
        await vi.waitFor(() => {
            const { state } = view.latest()
            expect(
                state.status === 'ready' && [...state.record.programs.keys()]
            ).toEqual([PRG_ONCE, PRG_OPEN])
        }, WAIT)
        // Never the record built for the old list after the prop changed.
        for (const { state } of view.seen.slice(changedAt)) {
            if (state.status === 'ready') {
                expect([...state.record.programs.keys()]).toEqual([
                    PRG_ONCE,
                    PRG_OPEN,
                ])
            }
        }
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
