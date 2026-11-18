import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { DataTableSearch, DataTableToolbar, type DataTableInstance } from '..'
import type { Person } from './dataTableTestSupport'
import { ToolsHarness, toolsRowNames, toolsState } from './toolsTestSupport'

let latest: DataTableInstance<Person> | undefined
const current = () => {
    if (!latest) throw new Error('The harness has not rendered.')
    return latest
}

const renderSearch = (debounce: number) =>
    render(
        <ToolsHarness
            onTable={(table) => {
                latest = table
            }}
        >
            <DataTableToolbar>
                <DataTableSearch debounce={debounce} />
            </DataTableToolbar>
        </ToolsHarness>
    )

const search = () => page.getByRole('searchbox', { name: 'Search' })
const globalFilter = () => toolsState().globalFilter ?? ''

describe('DataTableSearch', () => {
    it('applies typed text after the debounce', async () => {
        await renderSearch(150)

        await expect
            .element(search())
            .toHaveAttribute('data-slot', 'data-table-search')
        await expect.element(search()).toHaveAttribute('placeholder', 'Search')
        await userEvent.fill(search(), 'Kofi')

        await expect.element(search()).toHaveValue('Kofi')
        expect(globalFilter()).toBe('')
        await expect.poll(globalFilter).toBe('Kofi')
        expect(toolsRowNames()).toEqual(['Kofi 11'])
    })

    it('applies at once on Enter', async () => {
        await renderSearch(60_000)

        await userEvent.fill(search(), 'Amina')
        expect(globalFilter()).toBe('')
        await userEvent.keyboard('{Enter}')

        expect(globalFilter()).toBe('Amina')
    })

    it('applies a cleared search at once', async () => {
        await renderSearch(60_000)

        await userEvent.fill(search(), 'Amina')
        await userEvent.keyboard('{Enter}')
        await userEvent.fill(search(), '')

        expect(globalFilter()).toBe('')
        await expect.poll(() => toolsRowNames().length).toBe(10)
    })

    it('follows a global filter changed from outside', async () => {
        await renderSearch(200)

        await userEvent.fill(search(), 'pending')
        current().setGlobalFilter('Bo')

        await expect.element(search()).toHaveValue('Bo')
        // The pending text went with its timer.
        await new Promise((resolve) => setTimeout(resolve, 400))
        expect(globalFilter()).toBe('Bo')
        await expect.element(search()).toHaveValue('Bo')

        current().resetGlobalFilter(true)
        await expect.element(search()).toHaveValue('')
    })

    it('takes its name from the placeholder', async () => {
        await render(
            <ToolsHarness>
                <DataTableSearch placeholder="Search people" />
            </ToolsHarness>
        )

        await expect
            .element(page.getByRole('searchbox', { name: 'Search people' }))
            .toBeVisible()
    })
})

describe('DataTableToolbar', () => {
    it('is a named toolbar', async () => {
        await render(
            <ToolsHarness>
                <DataTableToolbar aria-label="People tools" className="x-1">
                    <span>Tool</span>
                </DataTableToolbar>
            </ToolsHarness>
        )

        const toolbar = page.getByRole('toolbar', { name: 'People tools' })
        await expect
            .element(toolbar)
            .toHaveAttribute('data-slot', 'data-table-toolbar')
        await expect.element(toolbar).toHaveClass('x-1')
    })
})
