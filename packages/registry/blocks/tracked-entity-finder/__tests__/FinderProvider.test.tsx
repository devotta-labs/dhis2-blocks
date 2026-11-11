import React, { useState } from 'react'
import { page } from 'vitest/browser'
import { FinderField } from '../form/FinderField'
import { FinderForm } from '../form/FinderForm'
import { FinderSubmit } from '../form/FinderSubmit'
import { FinderResults } from '../results/FinderResults'
import {
    createFakeServer,
    FinderTestProvider,
    renderWithQueries,
} from './finderTestSupport'
import { searchFor, settle } from './resultsTestSupport'

it('loads metadata through app-runtime and TanStack Query', async () => {
    const server = createFakeServer()
    await renderWithQueries(
        <FinderTestProvider
            program="hivProgram"
            server={server}
            onSelect={vi.fn()}
        >
            <FinderForm>
                <FinderField attribute="artNumber" />
            </FinderForm>
        </FinderTestProvider>
    )
    await expect
        .element(page.getByRole('textbox', { name: 'ART number' }))
        .toBeEnabled()
    expect(server.requests).toEqual(
        expect.arrayContaining([
            expect.objectContaining({ resource: 'programs', id: 'hivProgram' }),
            expect.objectContaining({ resource: 'system/info' }),
        ])
    )
})

it('keeps cached data when request logging rerenders the runtime provider', async () => {
    const LoggedFinder = () => {
        const [logs, setLogs] = useState(0)
        const [server] = useState(() =>
            createFakeServer({
                onRequest: () => setLogs((count) => count + 1),
            })
        )
        return (
            <FinderTestProvider
                program="hivProgram"
                server={server}
                onSelect={vi.fn()}
            >
                <FinderForm>
                    <FinderField attribute="artNumber" />
                    <FinderSubmit />
                </FinderForm>
                <FinderResults />
                <output data-testid="requests">{logs}</output>
            </FinderTestProvider>
        )
    }
    await renderWithQueries(<LoggedFinder />)
    await expect
        .element(page.getByRole('textbox', { name: 'ART number' }))
        .toBeEnabled()
    await expect.element(page.getByTestId('requests')).toHaveTextContent('2')
    await searchFor('A1')
    await expect.element(page.getByText('No one found')).toBeVisible()
    await searchFor('A1')
    await settle()
    await expect.element(page.getByTestId('requests')).toHaveTextContent('3')
})
