import React, { useState } from 'react'
import { render } from 'vitest-browser-react'
import { useDebouncedOrganisationUnitSearch } from './useDebouncedOrganisationUnitSearch'

const Harness = () => {
    const [search, setSearch] = useState('')
    const [debouncedSearch, setDebouncedSearch] =
        useDebouncedOrganisationUnitSearch(search)

    return (
        <>
            <input
                aria-label="OU search"
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
            />
            <output aria-label="Debounced OU search">{debouncedSearch}</output>
            <button
                type="button"
                onClick={() => {
                    setSearch('')
                    setDebouncedSearch('')
                }}
            >
                Close selector
            </button>
        </>
    )
}

describe('useDebouncedOrganisationUnitSearch', () => {
    it('forwards the exact value after 500ms and lets the host reset immediately on close', async () => {
        const screen = await render(<Harness />)
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
