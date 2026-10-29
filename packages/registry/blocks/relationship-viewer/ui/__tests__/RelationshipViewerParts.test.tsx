import React, { useState, type ReactNode } from 'react'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import type {
    DateOf,
    NodeKey,
    NodeRecord,
    RelationshipGraph,
    RelationshipStatus,
} from '../../domain/model'
import { generations, orientEdges } from '../../domain/orientation'
import { summarize } from '../../domain/summary'
import { traverse } from '../../domain/traverse'
import { chains, fakeFetch, superspreaders } from '../../__tests__/fixtures'
import { dateOf as fixtureDateOf } from '../../__tests__/graph'
import type {
    RelationshipViewerActions,
    RelationshipViewerLayout,
    RelationshipViewerMeta,
    RelationshipViewerState,
} from '../../provider/contracts'
import { RelationshipViewerProvider } from '../../provider/RelationshipViewerContext'
import { RelationshipViewerCanvas } from '../RelationshipViewerCanvas'
import { RelationshipViewerLayoutToggle } from '../RelationshipViewerLayoutToggle'
import { RelationshipViewerLegend } from '../RelationshipViewerLegend'
import { RelationshipViewerNotices } from '../RelationshipViewerNotices'
import { RelationshipViewerSummary } from '../RelationshipViewerSummary'

const STATUSES: RelationshipStatus[] = [
    {
        key: 'case',
        label: 'Case',
        color: 'red',
        attention: true,
        size: 'large',
    },
    { key: 'contact', label: 'Contact', color: 'blue' },
]

const te = (id: string): NodeKey => `trackedEntity:${id}`

const graphOf = (
    records: NodeRecord[],
    seedIds: string[],
    opts: { hops?: number; fail?: string[] } = {}
): Promise<RelationshipGraph> =>
    traverse(
        seedIds.map((id) => ({ kind: 'trackedEntity' as const, id })),
        fakeFetch(records, { fail: new Set(opts.fail) }),
        { hops: opts.hops ?? 1, cap: 500, concurrency: 6 }
    )

interface Setup {
    graph?: RelationshipGraph
    status?: RelationshipViewerState['status']
    error?: unknown
    dateOf?: DateOf
    children: ReactNode
}

const setup = async ({
    graph,
    status = 'ready',
    error,
    dateOf = fixtureDateOf,
    children,
}: Setup) => {
    const drawn = graph ?? {
        nodes: new Map(),
        edges: new Map(),
        order: [],
        capped: false,
    }
    const statusKey = (node: { seed: boolean }) =>
        node.seed ? 'case' : 'contact'
    const orientation = orientEdges(drawn, dateOf)
    const gens = generations(drawn, orientation)
    const meta = {
        statuses: STATUSES,
        statusOf: (node: { seed: boolean }) =>
            STATUSES.find((s) => s.key === statusKey(node)),
        labelOf: (node: { ref: { id: string } }) => node.ref.id,
        dateOf,
        orientation,
        generations: gens,
        summary: summarize(drawn, orientation, gens, statusKey, STATUSES),
        cap: 500,
    }
    const actions = {
        setLayout: vi.fn<RelationshipViewerActions['setLayout']>(),
        select: vi.fn<RelationshipViewerActions['select']>(),
        expand: vi.fn<RelationshipViewerActions['expand']>(),
        retry: vi.fn<RelationshipViewerActions['retry']>(),
    }
    const Harness = ({ meta }: { meta: RelationshipViewerMeta }) => {
        const [layout, setLayout] = useState<RelationshipViewerLayout>('web')
        return (
            <RelationshipViewerProvider
                state={{ status, error, graph, layout }}
                actions={{
                    ...actions,
                    setLayout: (next) => {
                        actions.setLayout(next)
                        setLayout(next)
                    },
                }}
                meta={meta}
            >
                {children}
            </RelationshipViewerProvider>
        )
    }
    const screen = await render(<Harness meta={meta} />)
    return {
        screen,
        actions,
        // What a host with inline rules does: equal meta, new objects.
        rebuildMeta: () =>
            screen.rerender(
                <Harness
                    meta={{ ...meta, orientation: new Map(meta.orientation) }}
                />
            ),
    }
}

const nodeAt = (container: HTMLElement, key: NodeKey) =>
    container.querySelector(`[data-node-key="${key}"]`)!

describe('RelationshipViewer parts', () => {
    it('draws one shape per node and one line per edge', async () => {
        const graph = await graphOf(superspreaders(), ['H1'])
        const { screen, actions } = await setup({
            graph,
            children: <RelationshipViewerCanvas />,
        })

        const { container } = screen
        expect(container.querySelectorAll('[data-node-key]')).toHaveLength(13)
        expect(container.querySelectorAll('[data-edge-id]')).toHaveLength(12)
        // Tracked entities are circles; the large seed is radius 9.
        expect(
            nodeAt(container, te('H1'))
                .querySelector('[data-glyph]')
                ?.getAttribute('r')
        ).toBe('9')
        expect(
            nodeAt(container, te('H1c01'))
                .querySelector('[data-glyph]')
                ?.getAttribute('r')
        ).toBe('5')
        // Two-way links have no arrowhead.
        expect(container.querySelector('[marker-end]')).toBeNull()

        await userEvent.click(
            nodeAt(container, te('H1c01')).querySelector('[data-glyph]')!
        )
        expect(actions.select).toHaveBeenCalledWith(te('H1c01'))
    })

    it('marks attention statuses with a ring', async () => {
        const graph = await graphOf(chains(), ['A1'])
        const { screen } = await setup({
            graph,
            children: (
                <>
                    <RelationshipViewerCanvas />
                    <RelationshipViewerLegend />
                </>
            ),
        })

        const { container } = screen
        const canvas = container.querySelector('svg[role="img"]')!
        expect(canvas.querySelectorAll('[data-attention-ring]')).toHaveLength(1)
        expect(
            nodeAt(container, te('A1')).querySelector('[data-attention-ring]')
        ).not.toBeNull()
        // One-way links point with an arrowhead.
        expect(canvas.querySelectorAll('[marker-end]')).toHaveLength(2)

        const legend = screen.getByRole('list', { name: 'Legend' })
        await expect.element(legend.getByText('Case')).toBeVisible()
        await expect.element(legend.getByText('Contact')).toBeVisible()
        await expect.element(legend.getByText('Tracked entity')).toBeVisible()
        await expect.element(legend.getByText('One-way link')).toBeVisible()
        expect(
            legend.element().querySelectorAll('[data-attention-ring]')
        ).toHaveLength(1)
    })

    it('clicking a stub expands', async () => {
        const graph = await graphOf(chains(), ['A1'])
        const { screen, actions } = await setup({
            graph,
            children: <RelationshipViewerCanvas />,
        })

        await userEvent.click(screen.getByText('+2'))

        expect(actions.expand).toHaveBeenCalledWith(te('A2'))
        expect(actions.select).not.toHaveBeenCalled()
    })

    it('clicking a failed node retries it', async () => {
        const graph = await graphOf(chains(), ['A1'], { fail: ['A2'] })
        const { screen, actions } = await setup({
            graph,
            children: <RelationshipViewerCanvas />,
        })

        const failed = screen.container.querySelectorAll('[data-failed]')
        expect(failed).toHaveLength(1)
        await userEvent.click(failed[0])

        expect(actions.retry).toHaveBeenCalledWith(te('A2'))
    })

    it('layout toggle switches to timeline and shows the no-date lane', async () => {
        const graph = await graphOf(chains(), ['A1'])
        const { screen, actions } = await setup({
            graph,
            dateOf: (node) =>
                node.key === te('A2') ? undefined : fixtureDateOf(node),
            children: (
                <>
                    <RelationshipViewerLayoutToggle />
                    <RelationshipViewerCanvas />
                </>
            ),
        })
        expect(screen.container.textContent).not.toContain('No date')

        await userEvent.click(screen.getByRole('button', { name: 'Timeline' }))

        expect(actions.setLayout).toHaveBeenCalledWith('timeline')
        await expect.element(screen.getByText('No date')).toBeInTheDocument()
        await expect.element(screen.getByText('2026-01-01')).toBeInTheDocument()
        await expect
            .element(screen.getByRole('button', { name: 'Timeline' }))
            .toHaveAttribute('aria-pressed', 'true')
    })

    it('summary shows the numbers and the partial note', async () => {
        const graph = await graphOf(chains(), ['A1'])
        const { screen } = await setup({
            graph,
            children: <RelationshipViewerSummary />,
        })

        const valueOf = (label: string) =>
            [...screen.container.querySelectorAll('dt')].find(
                (dt) => dt.textContent === label
            )?.nextElementSibling?.textContent
        expect(valueOf('Records')).toBe('3')
        expect(valueOf('Case')).toBe('1')
        expect(valueOf('Contact')).toBe('2')
        expect(valueOf('Need attention')).toBe('1')
        expect(valueOf('Clusters')).toBe('1')
        expect(valueOf('Largest cluster')).toBe('3')
        expect(valueOf('Generations')).toBe('2')
        expect(valueOf('Most links out')).toBe('2')
        expect(valueOf('Mean links out')).toBe('2')
        await expect
            .element(screen.getByText('Partial: some links are not loaded.'))
            .toBeVisible()
    })

    it('notices for cap, failures and errors', async () => {
        const graph = await graphOf(chains(), ['A1'], { fail: ['A2'] })
        const first = await setup({
            graph: { ...graph, capped: true },
            children: <RelationshipViewerNotices />,
        })
        await expect
            .element(
                first.screen.getByText(
                    'Showing the first 500 records. Some links are not loaded.'
                )
            )
            .toBeVisible()
        await expect
            .element(first.screen.getByText('One record could not be loaded.'))
            .toBeVisible()
        await userEvent.click(
            first.screen.getByRole('button', { name: 'Retry' })
        )
        expect(first.actions.retry).toHaveBeenCalledWith()
        await first.screen.unmount()

        const second = await setup({
            status: 'error',
            error: new Error('The server is unavailable.'),
            children: (
                <>
                    <RelationshipViewerNotices />
                    <RelationshipViewerCanvas />
                </>
            ),
        })
        await expect
            .element(second.screen.getByText('The server is unavailable.'))
            .toBeVisible()
        expect(second.screen.container.querySelector('svg[role="img"]')).toBe(
            null
        )
        await userEvent.click(
            second.screen.getByRole('button', { name: 'Retry' })
        )
        expect(second.actions.retry).toHaveBeenCalledWith()
    })

    it('empty seed query', async () => {
        const loading = await setup({
            status: 'loading',
            children: <RelationshipViewerCanvas />,
        })
        await expect.element(loading.screen.getByRole('status')).toBeVisible()
        await loading.screen.unmount()

        const graph = await graphOf([], [])
        const { screen } = await setup({
            graph,
            children: <RelationshipViewerCanvas />,
        })

        await expect
            .element(screen.getByText('Nobody matches these starting points.'))
            .toBeVisible()
    })

    it('svg has a name and a description', async () => {
        const graph = await graphOf(chains(), ['A1'])
        const { screen } = await setup({
            graph,
            children: <RelationshipViewerCanvas />,
        })

        const svg = screen.getByRole('img', { name: 'Relationship graph' })
        await expect
            .element(svg)
            .toHaveAccessibleDescription(
                '3 records in one cluster over 2 generations; one needs attention; some links are not loaded.'
            )
    })

    it('wheel zooms and Fit restores the fitted view', async () => {
        const graph = await graphOf(superspreaders(), ['H1'])
        const { screen } = await setup({
            graph,
            children: <RelationshipViewerCanvas />,
        })
        const svg = screen.container.querySelector('svg[role="img"]')!
        const fitted = svg.getAttribute('viewBox')
        const rect = svg.getBoundingClientRect()

        svg.dispatchEvent(
            new WheelEvent('wheel', {
                deltaY: -100,
                clientX: rect.left + rect.width / 2,
                clientY: rect.top + rect.height / 2,
                bubbles: true,
                cancelable: true,
            })
        )
        await vi.waitFor(() =>
            expect(svg.getAttribute('viewBox')).not.toBe(fitted)
        )

        await userEvent.click(screen.getByRole('button', { name: 'Fit' }))
        expect(svg.getAttribute('viewBox')).toBe(fitted)
    })

    it('dragging pans without clicking what it grabbed; a plain click still selects', async () => {
        const graph = await graphOf(chains(), ['A1', 'B1'], { fail: ['B2'] })
        const { screen, actions } = await setup({
            graph,
            children: <RelationshipViewerCanvas />,
        })
        const { container } = screen
        const svg = container.querySelector('svg[role="img"]')!
        const grabbed = [
            nodeAt(container, te('A1')).querySelector('[data-glyph]')!,
            container.querySelector('[data-stub]')!,
            container.querySelector('[data-failed]')!,
        ]

        for (const target of grabbed) {
            const before = svg.getAttribute('viewBox')
            const { left, top } = target.getBoundingClientRect()
            const at = (dx: number) => ({
                clientX: left + 2 + dx,
                clientY: top + 2,
                buttons: 1,
                bubbles: true,
            })
            target.dispatchEvent(new PointerEvent('pointerdown', at(0)))
            target.dispatchEvent(new PointerEvent('pointermove', at(10)))
            target.dispatchEvent(new PointerEvent('pointerup', at(10)))
            target.dispatchEvent(new MouseEvent('click', at(10)))
            await vi.waitFor(() =>
                expect(svg.getAttribute('viewBox')).not.toBe(before)
            )
        }
        expect(actions.select).not.toHaveBeenCalled()
        expect(actions.expand).not.toHaveBeenCalled()
        expect(actions.retry).not.toHaveBeenCalled()

        await userEvent.click(grabbed[0])
        expect(actions.select).toHaveBeenCalledWith(te('A1'))
    })

    it('an equal layout keeps the zoom', async () => {
        const graph = await graphOf(chains(), ['A1'])
        const { screen, rebuildMeta } = await setup({
            graph,
            children: (
                <>
                    <RelationshipViewerLayoutToggle />
                    <RelationshipViewerCanvas />
                </>
            ),
        })
        await userEvent.click(screen.getByRole('button', { name: 'Timeline' }))
        const svg = screen.container.querySelector('svg[role="img"]')!
        const fitted = svg.getAttribute('viewBox')
        svg.dispatchEvent(
            new WheelEvent('wheel', { deltaY: -100, bubbles: true })
        )
        await vi.waitFor(() =>
            expect(svg.getAttribute('viewBox')).not.toBe(fitted)
        )
        const zoomed = svg.getAttribute('viewBox')

        await rebuildMeta()

        expect(svg.getAttribute('viewBox')).toBe(zoomed)
    })
})
