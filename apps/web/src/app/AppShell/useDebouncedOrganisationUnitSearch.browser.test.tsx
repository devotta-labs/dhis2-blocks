import React from 'react'
import { render } from 'vitest-browser-react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { WorkingListClient } from '@/components/working-list/api/client'
import { useOrganisationUnitPicker } from './useOrganisationUnitPicker'

const client: WorkingListClient = {
    query: async (request, schema) =>
        schema.parse({
            organisationUnits: [
                {
                    id: 'result',
                    path: '/result',
                    displayName: request.params?.query,
                },
            ],
        }),
    mutate: async () => {
        throw new Error('Unexpected mutation')
    },
}

const Harness = () => {
    const picker = useOrganisationUnitPicker({
        client,
        programId: 'program',
        roots: [],
        onSelect: () => undefined,
    })

    return (
        <>
            <input
                aria-label="OU search"
                value={picker.contentProps.searchValue}
                onFocus={picker.open}
                onChange={(event) =>
                    picker.contentProps.onSearchChange(
                        event.currentTarget.value
                    )
                }
            />
            <output aria-label="Debounced OU search">
                {picker.contentProps.searchRoots?.[0]?.displayName}
            </output>
            <button type="button" onClick={picker.close}>
                Close selector
            </button>
        </>
    )
}

describe('useDebouncedOrganisationUnitSearch', () => {
    it('forwards the exact value after 500ms and lets the host reset immediately on close', async () => {
        const screen = await render(
            <QueryClientProvider client={new QueryClient()}>
                <Harness />
            </QueryClientProvider>
        )
        const input = screen.getByRole('textbox', { name: 'OU search' })
        const output = screen.getByLabelText('Debounced OU search')

        await input.fill('  Ngelehun  ')
        expect(output.element().textContent).toBe('')
        await vi.waitFor(
            () => expect(output.element().textContent).toBe('  Ngelehun  '),
            { timeout: 1000 }
        )

        await screen.getByRole('button', { name: 'Close selector' }).click()
        expect(output.element().textContent).toBe('')
    })
})
