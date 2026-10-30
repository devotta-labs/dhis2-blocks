import React from 'react'
import { userEvent } from 'vitest/browser'
import { chains, superspreaders } from '../../__tests__/fixtures'
import { RelationshipViewerCanvas } from '../RelationshipViewerCanvas'
import { RelationshipViewerLayoutToggle } from '../RelationshipViewerLayoutToggle'
import { RelationshipViewerList } from '../RelationshipViewerList'
import { graphOf, nodeAt, setup, te } from './harness'

describe('RelationshipViewer stacks, names and starting marks', () => {
    it("a hub's contacts draw as one stack", async () => {
        const graph = await graphOf(superspreaders(), ['H1'])
        const { screen } = await setup({
            graph,
            children: <RelationshipViewerCanvas />,
        })
        const { container } = screen
        const stacks = container.querySelectorAll('[data-stack]')
        expect(stacks).toHaveLength(1)
        expect(stacks[0].textContent).toContain('12 records')
        expect(container.querySelectorAll('[data-node-key]')).toHaveLength(1)
    })

    it('opening a stack draws its members', async () => {
        const graph = await graphOf(superspreaders(), ['H1'])
        const { screen } = await setup({
            graph,
            children: <RelationshipViewerCanvas />,
        })
        const { container } = screen
        await userEvent.click(container.querySelector('[data-stack]')!)
        expect(container.querySelectorAll('[data-node-key]')).toHaveLength(13)
        expect(container.querySelector('[data-stack]')).toBeNull()
    })

    it('selecting a member from the list pulls it out', async () => {
        const graph = await graphOf(superspreaders(), ['H1'])
        const { screen } = await setup({
            graph,
            children: (
                <>
                    <RelationshipViewerCanvas />
                    <RelationshipViewerList />
                </>
            ),
        })
        const { container } = screen
        await userEvent.click(
            container.querySelector(
                `tr[data-node-key="${te('H1c05')}"] button`
            )!
        )
        expect(
            container.querySelector(`g[data-node-key="${te('H1c05')}"]`)
        ).not.toBeNull()
        expect(container.querySelector('[data-stack]')?.textContent).toContain(
            '11 records'
        )
    })

    it('selecting a node outside any stack keeps positions', async () => {
        const graph = await graphOf(superspreaders(), ['H1', 'H2'])
        const { screen } = await setup({
            graph,
            children: <RelationshipViewerCanvas />,
        })
        const { container } = screen
        const transforms = () =>
            [
                ...container.querySelectorAll('[data-node-key], [data-stack]'),
            ].map((g) => g.getAttribute('transform'))
        const before = transforms()
        expect(container.querySelectorAll('[data-stack]')).toHaveLength(2)

        await userEvent.click(
            nodeAt(container, te('H1')).querySelector('[data-glyph]')!
        )

        expect(transforms()).toEqual(before)
    })

    it('seeds carry the seed mark, selection does not', async () => {
        const graph = await graphOf(chains(), ['A1'], { hops: 2 })
        const { screen } = await setup({
            graph,
            children: <RelationshipViewerCanvas />,
        })
        const { container } = screen
        const marks = () => container.querySelectorAll('[data-seed-mark]')
        expect(marks()).toHaveLength(1)
        expect(
            nodeAt(container, te('A1')).querySelector('[data-seed-mark]')
        ).not.toBeNull()

        await userEvent.click(
            nodeAt(container, te('A1c')).querySelector('[data-glyph]')!
        )
        expect(marks()).toHaveLength(1)
    })

    it.each(['Web', 'Trace'])(
        'a starting record that something drawn leads to has no mark (%s)',
        async (layout) => {
            // A2 is a starting record, but A1 exposed it.
            const graph = await graphOf(chains(), ['A1', 'A2'])
            const { screen } = await setup({
                graph,
                children: (
                    <>
                        <RelationshipViewerLayoutToggle />
                        <RelationshipViewerCanvas />
                    </>
                ),
            })
            await userEvent.click(screen.getByRole('button', { name: layout }))
            const { container } = screen
            expect(container.querySelectorAll('[data-seed-mark]')).toHaveLength(
                1
            )
            expect(
                nodeAt(container, te('A1')).querySelector('[data-seed-mark]')
            ).not.toBeNull()
        }
    )

    it('only seeds, attention nodes and the selected node are named', async () => {
        const graph = await graphOf(chains(), ['A1'], { hops: 2 })
        const { screen } = await setup({
            graph,
            children: <RelationshipViewerCanvas />,
        })
        const { container } = screen
        const labels = () =>
            [...container.querySelectorAll('[data-label]')].map(
                (t) => t.textContent
            )
        expect(labels()).toEqual(['A1'])

        await userEvent.click(
            nodeAt(container, te('A1c')).querySelector('[data-glyph]')!
        )
        expect(labels().sort()).toEqual(['A1', 'A1c'])
    })

    it('the trace draws stacks as cards', async () => {
        const graph = await graphOf(superspreaders(), ['H1'])
        const { screen } = await setup({
            graph,
            children: (
                <>
                    <RelationshipViewerLayoutToggle />
                    <RelationshipViewerCanvas />
                </>
            ),
        })
        await userEvent.click(screen.getByRole('button', { name: 'Trace' }))
        const stacks = screen.container.querySelectorAll('[data-stack]')
        expect(stacks).toHaveLength(1)
        expect(stacks[0].textContent).toContain('12 records')
        expect(
            screen.container.querySelectorAll('[data-trace-card]')
        ).toHaveLength(1)
    })

    it('opening a stack keeps the zoom', async () => {
        const graph = await graphOf(superspreaders(), ['H1', 'H2'])
        const { screen } = await setup({
            graph,
            children: <RelationshipViewerCanvas />,
        })
        const svg = screen.container.querySelector('svg[role="img"]')!
        const fitted = svg.getAttribute('viewBox')
        svg.dispatchEvent(
            new WheelEvent('wheel', { deltaY: -100, bubbles: true })
        )
        await vi.waitFor(() =>
            expect(svg.getAttribute('viewBox')).not.toBe(fitted)
        )
        const zoomed = svg.getAttribute('viewBox')

        await userEvent.click(screen.container.querySelector('[data-stack]')!)

        expect(screen.container.querySelectorAll('[data-stack]')).toHaveLength(
            1
        )
        // The view may move to keep the opened stack still; its zoom does not change.
        const size = (viewBox: string | null) => viewBox?.split(' ').slice(2)
        expect(size(svg.getAttribute('viewBox'))).toEqual(size(zoomed))
    })
})
