import React from 'react'
import { userEvent } from 'vitest/browser'
import { chains } from '../../__tests__/fixtures'
import type { NodeKey, RelationshipGraph } from '../../domain/model'
import { RelationshipViewerCanvas } from '../RelationshipViewerCanvas'
import { RelationshipViewerList } from '../RelationshipViewerList'
import { graphOf, nodeAt, setup, te } from './harness'

const rowOf = (container: HTMLElement, key: NodeKey) =>
    container.querySelector<HTMLElement>(`tr[data-node-key="${key}"]`)!

const names = (container: HTMLElement) =>
    [...container.querySelectorAll('tbody tr')].map(
        (row) => row.querySelector('td')?.textContent
    )

const withOtherLinks = (
    graph: RelationshipGraph,
    key: NodeKey,
    otherLinkCount: number
): RelationshipGraph => ({
    ...graph,
    nodes: new Map(graph.nodes).set(key, {
        ...graph.nodes.get(key)!,
        otherLinkCount,
    }),
})

describe('RelationshipViewerList', () => {
    it('lists attention statuses first', async () => {
        const graph = await graphOf(chains(), ['A1'])
        const { screen } = await setup({
            graph,
            statusKey: (node) => (node.ref.id === 'A1c' ? 'case' : 'contact'),
            children: <RelationshipViewerList />,
        })

        await expect
            .element(
                screen.getByRole('table', {
                    name: 'Records in the relationship graph',
                })
            )
            .toBeVisible()
        const headers = [...screen.container.querySelectorAll('th')].map(
            (th) => th.textContent
        )
        expect(headers).toEqual(['Name', 'Status', 'Hop', 'Links', 'Linked to'])
        // Attention first, then discovery order.
        expect(names(screen.container)).toEqual(['A1c', 'A1', 'A2'])
        const cells = [
            ...rowOf(screen.container, te('A1c')).querySelectorAll('td'),
        ].map((td) => td.textContent)
        expect(cells).toEqual(['A1c', 'Case', '1', '1', 'A1'])
        const first = [
            ...rowOf(screen.container, te('A1')).querySelectorAll('td'),
        ].map((td) => td.textContent)
        expect(first.slice(1, 4)).toEqual(['Contact', '0', '2'])
    })

    it('selecting a row selects the node in the canvas', async () => {
        const graph = await graphOf(chains(), ['A1'])
        const { screen, actions } = await setup({
            graph,
            children: <RelationshipViewerList />,
        })
        const { container } = screen

        await userEvent.click(
            rowOf(container, te('A1c')).querySelector('button')!
        )
        expect(actions.select).toHaveBeenLastCalledWith(te('A1c'))

        // Elsewhere on the row selects too.
        await userEvent.click(
            rowOf(container, te('A2')).querySelectorAll('td')[2]
        )
        expect(actions.select).toHaveBeenLastCalledWith(te('A2'))

        // A linked record's button selects that record, once.
        actions.select.mockClear()
        await userEvent.click(
            rowOf(container, te('A1c'))
                .querySelectorAll('td')[4]
                .querySelector('button')!
        )
        expect(actions.select).toHaveBeenCalledOnce()
        expect(actions.select).toHaveBeenCalledWith(te('A1'))
    })

    it('selecting in the canvas marks the row', async () => {
        const graph = await graphOf(chains(), ['A1'])
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
        const scrollIntoView = vi.spyOn(
            rowOf(container, te('A2')).querySelector('button')!,
            'scrollIntoView'
        )
        expect(
            container.querySelectorAll('tr[aria-selected="true"]')
        ).toHaveLength(0)

        await userEvent.click(
            nodeAt(container, te('A2')).querySelector('[data-glyph]')!
        )

        await vi.waitFor(() =>
            expect(
                rowOf(container, te('A2')).getAttribute('aria-selected')
            ).toBe('true')
        )
        expect(
            container.querySelectorAll('tr[aria-selected="true"]')
        ).toHaveLength(1)
        expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' })
    })

    it('Enter on a name selects its row and marks it current', async () => {
        const graph = await graphOf(chains(), ['A1'])
        const { screen, actions } = await setup({
            graph,
            children: <RelationshipViewerList />,
        })
        const name = rowOf(screen.container, te('A2')).querySelector('button')!
        expect(name.getAttribute('aria-current')).toBe(null)

        name.focus()
        await userEvent.keyboard('{Enter}')

        expect(actions.select).toHaveBeenLastCalledWith(te('A2'))
        await vi.waitFor(() =>
            expect(name.getAttribute('aria-current')).toBe('true')
        )
        expect(
            rowOf(screen.container, te('A2')).getAttribute('aria-selected')
        ).toBe('true')
        expect(
            screen.container.querySelectorAll('[aria-current="true"]')
        ).toHaveLength(1)
    })

    it('expand and retry work from the keyboard', async () => {
        const graph = await graphOf(chains(), ['A1', 'B1'], { fail: ['B2'] })
        const { screen, actions } = await setup({
            graph,
            children: <RelationshipViewerList />,
        })
        const { container } = screen

        const show = screen.getByRole('button', { name: 'Show 2 more' })
        show.element().focus()
        await userEvent.keyboard('{Enter}')
        expect(actions.expand).toHaveBeenCalledWith(te('A2'))

        const failed = rowOf(container, te('B2'))
        expect(failed.textContent).toContain('Could not load')
        failed.querySelector<HTMLElement>('td:nth-child(2) button')!.focus()
        await userEvent.keyboard(' ')
        expect(actions.retry).toHaveBeenCalledWith(te('B2'))
        expect(actions.select).not.toHaveBeenCalled()
    })

    it('expand and retry buttons name their row', async () => {
        const graph = await graphOf(chains(), ['A1', 'B1'], { fail: ['B2'] })
        const { screen } = await setup({
            graph,
            children: <RelationshipViewerList />,
        })

        await expect
            .element(screen.getByRole('button', { name: 'Show 2 more for A2' }))
            .toBeVisible()
        await expect
            .element(screen.getByRole('button', { name: 'Retry B2' }))
            .toBeVisible()
    })

    it('button names keep special characters unescaped', async () => {
        const graph = await graphOf(chains(), ['A1', 'B1'], { fail: ['B2'] })
        const { screen } = await setup({
            graph,
            labelOf: (node) => `O'Brien & Sons/Co ${node.ref.id}`,
            children: <RelationshipViewerList />,
        })

        await expect
            .element(
                screen.getByRole('button', {
                    name: "Show 2 more for O'Brien & Sons/Co A2",
                    exact: true,
                })
            )
            .toBeVisible()
        await expect
            .element(
                screen.getByRole('button', {
                    name: "Retry O'Brien & Sons/Co B2",
                    exact: true,
                })
            )
            .toBeVisible()
    })

    it('other links are counted', async () => {
        const base = await graphOf(chains(), ['A1'])
        const many = await setup({
            graph: withOtherLinks(base, te('A1'), 3),
            children: <RelationshipViewerList />,
        })
        await expect
            .element(many.screen.getByText('3 other links not shown'))
            .toBeVisible()
        await many.screen.unmount()

        const one = await setup({
            graph: withOtherLinks(base, te('A1'), 1),
            children: <RelationshipViewerList />,
        })
        await expect
            .element(one.screen.getByText('One other link not shown'))
            .toBeVisible()
    })

    it('shows the singular expand label', async () => {
        const graph = await graphOf(chains(), ['A1'])
        const { screen } = await setup({
            graph: {
                ...graph,
                nodes: new Map(graph.nodes).set(te('A2'), {
                    ...graph.nodes.get(te('A2'))!,
                    stubCount: 1,
                }),
            },
            children: <RelationshipViewerList />,
        })

        await expect
            .element(
                screen.getByRole('button', { name: 'Show one more for A2' })
            )
            .toBeVisible()
    })

    it('empty seed query', async () => {
        const graph = await graphOf([], [])
        const { screen } = await setup({
            graph,
            children: <RelationshipViewerList />,
        })

        await expect
            .element(screen.getByText('Nobody matches these starting points.'))
            .toBeVisible()
        expect(screen.container.querySelector('table')).toBeNull()
    })
})
