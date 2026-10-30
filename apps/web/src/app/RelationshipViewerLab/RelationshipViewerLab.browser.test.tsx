import React from 'react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { RelationshipViewerLab } from './RelationshipViewerLab'

const Search = () => <output data-search={useLocation().search} />

const renderLab = (search: string) =>
    render(
        <MemoryRouter initialEntries={[`/${search}`]}>
            <RelationshipViewerLab />
            <Search />
        </MemoryRouter>
    )

const searchOf = (container: HTMLElement) =>
    container.querySelector('[data-search]')?.getAttribute('data-search')

describe('RelationshipViewerLab', () => {
    it('fixture hubs draw three stacks', async () => {
        const screen = await renderLab('?scenario=hubs')
        await vi.waitFor(() =>
            expect(
                screen.container.querySelectorAll('[data-stack]')
            ).toHaveLength(3)
        )
    })

    it('selecting shows the host panel', async () => {
        const screen = await renderLab('?scenario=chains')
        await vi.waitFor(() =>
            expect(
                screen.container.querySelector('tr[data-node-key] button')
            ).not.toBeNull()
        )
        await userEvent.click(
            screen.container.querySelector(
                'tr[data-node-key="trackedEntity:A1c"] button'
            )!
        )
        await expect
            .element(screen.getByText('trackedEntity:A1c'))
            .toBeVisible()
    })

    it('re-centre writes the seed', async () => {
        const screen = await renderLab('?scenario=chains')
        await vi.waitFor(() =>
            expect(
                screen.container.querySelector(
                    'tr[data-node-key="trackedEntity:A2"] button'
                )
            ).not.toBeNull()
        )
        await userEvent.click(
            screen.container.querySelector(
                'tr[data-node-key="trackedEntity:A2"] button'
            )!
        )
        await userEvent.click(
            screen.getByRole('button', { name: 'Re-centre here' })
        )
        expect(searchOf(screen.container)).toContain('seed=A2')
        await vi.waitFor(() =>
            expect(
                screen.container
                    .querySelector('tbody tr')
                    ?.getAttribute('data-node-key')
            ).toBe('trackedEntity:A2')
        )
    })
})
