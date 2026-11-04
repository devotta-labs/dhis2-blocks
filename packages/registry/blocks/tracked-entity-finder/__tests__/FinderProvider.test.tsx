import React from 'react'
import { page } from 'vitest/browser'
import { FinderField } from '../form/FinderField'
import { FinderForm } from '../form/FinderForm'
import { FinderProvider } from '../provider/FinderProvider'
import { createFakeServer, renderWithQueries } from './finderTestSupport'

it('loads metadata with a supplied client without a DHIS2 runtime provider', async () => {
    const server = createFakeServer()
    await renderWithQueries(
        <FinderProvider
            program="hivProgram"
            client={server.client}
            onSelect={vi.fn()}
        >
            <FinderForm>
                <FinderField attribute="artNumber" />
            </FinderForm>
        </FinderProvider>
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
