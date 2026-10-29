/* oxlint-disable anti-slop/no-module-mocking -- These tests replace only the app-runtime engine hook with a fixture engine. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { type ReactNode } from 'react'
import { render } from 'vitest-browser-react'
import type { DataEngineLike } from '../../api/client'
import type { NodeKey, RelationshipStatus } from '../../domain/model'
import {
    chains,
    FIXTURE_PROGRAM,
    person,
    superspreaders,
} from '../../__tests__/fixtures'
import type {
    RelationshipViewerActions,
    RelationshipViewerMeta,
    RelationshipViewerState,
} from '../../provider/contracts'
import {
    useRelationshipViewerActions,
    useRelationshipViewerMeta,
    useRelationshipViewerState,
} from '../../provider/RelationshipViewerContext'
import {
    RelationshipViewer,
    type RelationshipViewerProps,
} from '../RelationshipViewer'
import { fakeEngine } from './fakeEngine'

interface MockRuntime {
    engine?: DataEngineLike
}

const runtime = vi.hoisted((): MockRuntime => ({}))

vi.mock('@dhis2/app-runtime', () => ({
    useDataEngine: () => runtime.engine,
}))

const STATUSES: RelationshipStatus[] = [
    { key: 'case', label: 'Case', color: 'red', attention: true },
    { key: 'contact', label: 'Contact', color: 'blue' },
]

const te = (id: string): NodeKey => `trackedEntity:${id}`

interface BoundaryState {
    error?: Error
}

class Boundary extends React.Component<{ children: ReactNode }, BoundaryState> {
    override state: BoundaryState = {}

    static getDerivedStateFromError(error: Error) {
        return { error }
    }

    override render() {
        return this.state.error ? (
            <p>{this.state.error.message}</p>
        ) : (
            this.props.children
        )
    }
}

const renderViewer = async (
    engine: DataEngineLike,
    props: Partial<RelationshipViewerProps> = {}
) => {
    runtime.engine = engine
    const seen: {
        state: RelationshipViewerState
        actions: RelationshipViewerActions
        meta: RelationshipViewerMeta
    }[] = []
    const Probe = () => {
        seen.push({
            state: useRelationshipViewerState(),
            actions: useRelationshipViewerActions(),
            meta: useRelationshipViewerMeta(),
        })
        return null
    }
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    const element = (extra: Partial<RelationshipViewerProps> = {}) => (
        <QueryClientProvider client={queryClient}>
            <RelationshipViewer
                seeds={{ refs: [] }}
                statuses={STATUSES}
                statusOf={(node) => (node.seed ? 'case' : 'contact')}
                {...props}
                {...extra}
            >
                <Probe />
            </RelationshipViewer>
        </QueryClientProvider>
    )
    const screen = await render(element())
    // SAFETY: the provider renders the probe synchronously on mount.
    const latest = () => seen.at(-1)!
    const ready = () =>
        vi.waitFor(() => {
            expect(latest().state.status).toBe('ready')
            return latest()
        })
    return {
        seen,
        latest,
        ready,
        rerender: (extra: Partial<RelationshipViewerProps>) =>
            screen.rerender(element(extra)),
    }
}

describe('RelationshipViewer', () => {
    it('loads one case and its contacts', async () => {
        const { engine, nodeCalls } = fakeEngine(superspreaders())
        const { ready } = await renderViewer(engine, {
            seeds: { refs: [{ kind: 'trackedEntity', id: 'H1' }] },
            labelOf: (node, base) => `${base}!`,
        })

        const { state, meta } = await ready()

        expect(state.graph?.nodes.size).toBe(13)
        expect(state.graph?.nodes.get(te('H1'))?.seed).toBe(true)
        expect(state.layout).toBe('web')
        expect(state.selected).toBeUndefined()
        expect(meta.cap).toBe(500)
        expect(meta.labelOf(state.graph!.nodes.get(te('H1'))!)).toBe('H1!')
        expect(meta.summary.nodeCount).toBe(13)
        expect(meta.orientation.size).toBe(12)
        expect(meta.generations.get(te('H1'))).toBe(0)
        expect(nodeCalls('H1')).toBe(1)
        expect(nodeCalls('H1c01')).toBe(1)
    })

    it('seed query draws every seed', async () => {
        const seeds = Array.from({ length: 60 }, (_, i) => person(`S${i}`))
        const { engine, calls, nodeCalls } = fakeEngine(seeds, { seeds })
        const { ready } = await renderViewer(engine, {
            seeds: { query: { program: FIXTURE_PROGRAM } },
        })

        const { state } = await ready()

        expect(state.graph?.nodes.size).toBe(60)
        expect([...state.graph!.nodes.values()].every((n) => n.seed)).toBe(true)
        expect(state.graph?.capped).toBe(false)
        expect(
            calls.filter((c) => c.startsWith('tracker/trackedEntities?'))
        ).toEqual([
            'tracker/trackedEntities?page=1',
            'tracker/trackedEntities?page=2',
        ])
        // Seed pages yield refs; each seed is fetched once, like any node.
        expect(seeds.every((s) => nodeCalls(s.ref.id) === 1)).toBe(true)
        expect(
            calls.filter((c) => c.startsWith('tracker/relationships'))
        ).toHaveLength(60)
    })

    it('seed query past the cap stops paging and reports capped', async () => {
        const seeds = Array.from({ length: 120 }, (_, i) => person(`S${i}`))
        const { engine, calls } = fakeEngine(seeds, { seeds })
        const { ready } = await renderViewer(engine, {
            seeds: { query: { program: FIXTURE_PROGRAM } },
            cap: 50,
        })

        const { state } = await ready()

        expect(state.graph?.nodes.size).toBe(50)
        expect(state.graph?.capped).toBe(true)
        expect(
            calls.filter((c) => c.startsWith('tracker/trackedEntities?'))
        ).toEqual([
            'tracker/trackedEntities?page=1',
            'tracker/trackedEntities?page=2',
        ])
    })

    it('empty seed query', async () => {
        const { engine } = fakeEngine([], { seeds: [] })
        const { ready } = await renderViewer(engine, {
            seeds: { query: { program: FIXTURE_PROGRAM } },
        })

        const { state, meta } = await ready()

        expect(state.graph?.nodes.size).toBe(0)
        expect(meta.summary.nodeCount).toBe(0)
    })

    it('expand draws the next ring without refetching known nodes', async () => {
        const { engine, nodeCalls } = fakeEngine(chains())
        const { ready, seen, latest } = await renderViewer(engine, {
            seeds: { refs: [{ kind: 'trackedEntity', id: 'A1' }] },
        })
        const first = await ready()
        expect([...first.state.graph!.nodes.keys()]).toEqual([
            te('A1'),
            te('A1c'),
            te('A2'),
        ])
        const before = seen.length

        first.actions.expand(te('A2'))

        await vi.waitFor(() => {
            expect(latest().state.graph?.nodes.size).toBe(5)
        })
        expect(latest().state.graph?.nodes.has(te('A3'))).toBe(true)
        expect(latest().state.graph?.nodes.has(te('A2c'))).toBe(true)
        for (const { state } of seen.slice(before)) {
            expect(state.graph?.nodes.size ?? 0).toBeGreaterThanOrEqual(3)
        }
        expect(
            ['A1', 'A1c', 'A2', 'A2c', 'A3'].map((id) => nodeCalls(id))
        ).toEqual([1, 1, 1, 1, 1])
    })

    it('retry refetches only failed nodes', async () => {
        const { engine, fail, nodeCalls } = fakeEngine(chains(), {
            fail: ['A1c', 'A2'],
        })
        const { ready, latest } = await renderViewer(engine, {
            seeds: { refs: [{ kind: 'trackedEntity', id: 'A1' }] },
        })
        const first = await ready()
        const statusOf = (id: string) =>
            latest().state.graph?.nodes.get(te(id))?.state.status
        expect(first.state.status).toBe('ready')
        expect(statusOf('A1c')).toBe('failed')
        expect(statusOf('A2')).toBe('failed')
        fail.clear()

        first.actions.retry(te('A1c'))
        await vi.waitFor(() => expect(statusOf('A1c')).toBe('loaded'))
        expect(statusOf('A2')).toBe('failed')
        expect(['A1', 'A1c', 'A2'].map(nodeCalls)).toEqual([1, 2, 1])

        latest().actions.retry()
        await vi.waitFor(() => expect(statusOf('A2')).toBe('loaded'))
        expect(['A1', 'A1c', 'A2'].map(nodeCalls)).toEqual([1, 2, 2])
    })

    it('metadata failure is a graph error that retry recovers', async () => {
        const { engine, fail } = fakeEngine(superspreaders(), {
            fail: ['relationshipTypes'],
        })
        const { latest, ready } = await renderViewer(engine, {
            seeds: { refs: [{ kind: 'trackedEntity', id: 'H1' }] },
        })
        await vi.waitFor(() => expect(latest().state.status).toBe('error'))
        expect(latest().state.error).toEqual({ status: 404 })
        fail.clear()

        latest().actions.retry()

        const { state } = await ready()
        expect(state.graph?.nodes.size).toBe(13)
    })

    it('expand after more than 5 minutes refetches no known node', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
        try {
            const records = chains()
            const { engine, nodeCalls } = fakeEngine(records, {
                seeds: records.filter((r) => r.ref.id === 'A1'),
            })
            const { ready, latest } = await renderViewer(engine, {
                seeds: { query: { program: FIXTURE_PROGRAM } },
            })
            expect((await ready()).state.graph?.nodes.size).toBe(3)

            vi.advanceTimersByTime(10 * 60_000)
            latest().actions.expand(te('A2'))

            await vi.waitFor(() => {
                expect(latest().state.graph?.nodes.size).toBe(5)
            })
            expect(
                ['A1', 'A1c', 'A2', 'A2c', 'A3'].map((id) => nodeCalls(id))
            ).toEqual([1, 1, 1, 1, 1])
        } finally {
            vi.useRealTimers()
        }
    })

    it.each([
        ['no program prop', undefined],
        ['an empty program prop', ''],
    ])(
        'with %s, the seed query program applies to every node',
        async (_, program) => {
            const records = chains()
            const { engine, requests, nodeCalls } = fakeEngine(records, {
                seeds: records.filter((r) => r.ref.id === 'A1'),
            })
            const { ready } = await renderViewer(engine, {
                seeds: { query: { program: FIXTURE_PROGRAM } },
                program,
            })

            expect((await ready()).state.graph?.nodes.size).toBe(3)

            const nodeRequests = requests.filter((r) => r.id !== undefined)
            expect(nodeRequests.map((r) => r.id)).toEqual(['A1', 'A1c', 'A2'])
            for (const request of nodeRequests) {
                expect(request.params?.program).toBe(FIXTURE_PROGRAM)
            }
            expect(nodeCalls('A1')).toBe(1)
        }
    )

    it('the default dateOf reads the seed query program enrollment', async () => {
        const seed = person('S1', { enrolledAt: '2026-03-01' })
        const record = {
            ...seed,
            enrollments: [
                {
                    enrollment: 'S1-other',
                    program: 'OtherProg01',
                    status: 'ACTIVE' as const,
                    followUp: false,
                    enrolledAt: '2025-06-01',
                },
                ...seed.enrollments,
            ],
        }
        const { engine } = fakeEngine([record], { seeds: [record] })
        const { ready } = await renderViewer(engine, {
            seeds: { query: { program: FIXTURE_PROGRAM } },
        })

        const { state, meta } = await ready()

        expect(
            meta.dateOf(state.graph!.nodes.get(te('S1'))!)?.toISOString()
        ).toBe('2026-03-01T00:00:00.000Z')
    })

    it('a program that differs from the seed query program throws', async () => {
        runtime.engine = fakeEngine([], { seeds: [] }).engine
        const screen = await render(
            <QueryClientProvider client={new QueryClient()}>
                <Boundary>
                    <RelationshipViewer
                        seeds={{ query: { program: 'SeedProg001' } }}
                        program="OtherProg01"
                        statuses={STATUSES}
                        statusOf={() => 'case'}
                    >
                        {null}
                    </RelationshipViewer>
                </Boundary>
            </QueryClientProvider>
        )

        await expect
            .element(
                screen.getByText(
                    'RelationshipViewer received program "OtherProg01" but its seed query reads program "SeedProg001". Pass one program for both.'
                )
            )
            .toBeVisible()
    })

    it('re-centring shows loading, then the new graph', async () => {
        const { engine } = fakeEngine(superspreaders())
        const { ready, seen, latest, rerender } = await renderViewer(engine, {
            seeds: { refs: [{ kind: 'trackedEntity', id: 'H1' }] },
        })
        await ready()
        const before = seen.length

        await rerender({
            seeds: { refs: [{ kind: 'trackedEntity', id: 'H2' }] },
        })

        await vi.waitFor(() => {
            expect(latest().state.graph?.nodes.has(te('H2'))).toBe(true)
        })
        const after = seen.slice(before)
        expect(after[0].state.status).toBe('loading')
        expect(after[0].state.graph).toBeUndefined()
        expect(after.some((s) => s.state.graph?.nodes.has(te('H1')))).toBe(
            false
        )
        expect(latest().state.status).toBe('ready')
    })

    it('layout and selection work controlled and uncontrolled', async () => {
        const { engine } = fakeEngine(superspreaders())
        const onLayoutChange = vi.fn()
        const onSelectedChange = vi.fn()
        const uncontrolled = await renderViewer(engine, {
            onLayoutChange,
            onSelectedChange,
        })

        uncontrolled.latest().actions.setLayout('timeline')
        uncontrolled.latest().actions.select(te('H1'))

        await vi.waitFor(() => {
            expect(uncontrolled.latest().state.layout).toBe('timeline')
            expect(uncontrolled.latest().state.selected).toBe(te('H1'))
        })
        expect(onLayoutChange).toHaveBeenCalledWith('timeline')
        expect(onSelectedChange).toHaveBeenCalledWith(te('H1'))

        const onControlledLayout = vi.fn()
        const onControlledSelected = vi.fn()
        const controlled = await renderViewer(engine, {
            layout: 'web',
            onLayoutChange: onControlledLayout,
            selected: undefined,
            onSelectedChange: onControlledSelected,
        })

        controlled.latest().actions.setLayout('timeline')
        controlled.latest().actions.select(te('H1'))

        expect(onControlledLayout).toHaveBeenCalledWith('timeline')
        expect(onControlledSelected).toHaveBeenCalledWith(te('H1'))
        await controlled.rerender({ selected: te('H2') })
        expect(controlled.latest().state.layout).toBe('web')
        expect(controlled.latest().state.selected).toBe(te('H2'))
    })

    it('statusOf keys outside statuses resolve to undefined', async () => {
        const { engine } = fakeEngine(superspreaders())
        const { ready } = await renderViewer(engine, {
            seeds: { refs: [{ kind: 'trackedEntity', id: 'H1' }] },
            statusOf: (node) => (node.seed ? 'case' : 'unknown'),
        })

        const { state, meta } = await ready()

        expect(meta.statusOf(state.graph!.nodes.get(te('H1'))!)).toBe(
            STATUSES[0]
        )
        expect(
            meta.statusOf(state.graph!.nodes.get(te('H1c01'))!)
        ).toBeUndefined()
        expect(meta.summary.statusCounts).toEqual([
            { status: STATUSES[0], count: 1 },
            { status: STATUSES[1], count: 0 },
        ])
    })
})
