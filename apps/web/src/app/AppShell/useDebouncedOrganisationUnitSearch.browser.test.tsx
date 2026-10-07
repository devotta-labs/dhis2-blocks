import React from 'react'
import { render } from 'vitest-browser-react'
import { useDebouncedOrganisationUnitSearch } from './useDebouncedOrganisationUnitSearch'

const Harness = () => {
    const [search, debouncedSearch, setSearch, reset] =
        useDebouncedOrganisationUnitSearch()

    return (
        <>
            <input
                aria-label="OU search"
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
            />
            <output aria-label="Debounced OU search">{debouncedSearch}</output>
            <button type="button" onClick={reset}>
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

    it('cancels pending text when closed and debounces only the latest event after reopening', async () => {
        const screen = await render(<Harness />)
        const input = screen.getByRole('textbox', { name: 'OU search' })
        const output = screen.getByLabelText('Debounced OU search')

        await input.fill('old search')
        await screen.getByRole('button', { name: 'Close selector' }).click()
        await new Promise((resolve) => window.setTimeout(resolve, 550))
        expect(output.element().textContent).toBe('')
        await input.fill('first new search')
        await input.fill('latest search')
        expect(output.element().textContent).toBe('')
        await vi.waitFor(
            () => expect(output.element().textContent).toBe('latest search'),
            { timeout: 1000 }
        )
    })

    it('clears the pending search timer when the owner unmounts', async () => {
        const schedule = vi.spyOn(window, 'setTimeout')
        const cancel = vi.spyOn(window, 'clearTimeout')

        try {
            const screen = await render(<Harness />)
            await screen
                .getByRole('textbox', { name: 'OU search' })
                .fill('pending search')

            const timerIndex = schedule.mock.calls.findLastIndex(
                ([, delay]) => delay === 500
            )

            expect(timerIndex).toBeGreaterThanOrEqual(0)
            const timer = schedule.mock.results[timerIndex].value
            cancel.mockClear()
            await screen.unmount()
            expect(cancel).toHaveBeenCalledWith(timer)
        } finally {
            vi.restoreAllMocks()
        }
    })
})
