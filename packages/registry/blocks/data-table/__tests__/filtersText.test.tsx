import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { DataTableFilters, type DataTableFilter } from '..'
import { ToolsHarness, toolsRowNames, toolsState } from './toolsTestSupport'

const nameFilter: DataTableFilter = {
    id: 'name',
    kind: 'text',
    label: 'Name',
    pinned: true,
}
const districtFilter: DataTableFilter = {
    id: 'district',
    kind: 'options',
    label: 'District',
    multiple: true,
    options: [
        { value: 'Bo', label: 'Bo' },
        { value: 'Kenema', label: 'Kenema' },
    ],
}

// The caller's own entry: not one of the filters, so the chips leave it alone.
const foreign = { id: 'age', value: { kind: 'number', min: 30 } }

const renderFilters = (filters: readonly DataTableFilter[]) =>
    render(
        <ToolsHarness options={{ initialState: { columnFilters: [foreign] } }}>
            <DataTableFilters filters={filters} />
        </ToolsHarness>
    )

const chip = (name: string) => page.getByRole('combobox', { name, exact: true })

const filtersInState = () => toolsState().columnFilters

describe('DataTableFilters: chips and state', () => {
    it('shows a pinned chip and offers the others under "Filter"', async () => {
        await renderFilters([nameFilter, districtFilter])

        await expect.element(chip('Name')).toBeVisible()
        await expect.element(chip('District')).not.toBeInTheDocument()
        await expect
            .element(page.getByRole('button', { name: 'Filter' }))
            .toHaveAttribute('data-slot', 'data-table-add-filter')
        expect(
            document.querySelector('[data-slot="data-table-filters"]')
        ).not.toBeNull()
    })

    it('keeps the draft out of state until Apply, then returns focus to the chip', async () => {
        await renderFilters([nameFilter])

        await chip('Name').click()
        const dialog = page.getByRole('dialog', { name: 'Name' })
        await expect.element(dialog).toBeVisible()
        await userEvent.fill(dialog.getByLabelText('Value'), 'Amina')
        expect(filtersInState()).toEqual([foreign])

        await dialog.getByRole('button', { name: 'Apply' }).click()

        await expect.element(dialog).not.toBeInTheDocument()
        expect(filtersInState()).toEqual([
            foreign,
            {
                id: 'name',
                value: { kind: 'text', operator: 'contains', text: 'Amina' },
            },
        ])
        await expect.element(chip('Name: Amina')).toHaveFocus()
        // Client mode: the rows follow both entries.
        expect(toolsRowNames()).toEqual(['Amina 12'])
    })

    it('applies with Enter and replaces the entry in place', async () => {
        await renderFilters([nameFilter])

        await chip('Name').click()
        await userEvent.fill(page.getByLabelText('Value'), 'Amina')
        await userEvent.keyboard('{Enter}')
        await expect.element(chip('Name: Amina')).toBeVisible()

        await chip('Name: Amina').click()
        await expect.element(page.getByLabelText('Value')).toHaveValue('Amina')
        await userEvent.fill(page.getByLabelText('Value'), 'Kofi')
        await userEvent.keyboard('{Enter}')

        await expect.element(chip('Name: Kofi')).toBeVisible()
        expect(filtersInState()).toEqual([
            foreign,
            {
                id: 'name',
                value: { kind: 'text', operator: 'contains', text: 'Kofi' },
            },
        ])
    })

    it('clears only its own entry with the clear button and Reset', async () => {
        await renderFilters([nameFilter])

        await chip('Name').click()
        await userEvent.fill(page.getByLabelText('Value'), 'Amina')
        await userEvent.keyboard('{Enter}')
        const clear = page.getByRole('button', { name: 'Clear Name' })
        await expect
            .element(clear)
            .toHaveAttribute('data-slot', 'data-table-filter-clear')
        await clear.click()

        expect(filtersInState()).toEqual([foreign])
        // A pinned chip stays, and keeps focus.
        await expect.element(chip('Name')).toHaveFocus()
        await expect.element(clear).not.toBeInTheDocument()

        await chip('Name').click()
        await userEvent.fill(page.getByLabelText('Value'), 'Kofi')
        await userEvent.keyboard('{Enter}')
        await chip('Name: Kofi').click()
        await page.getByRole('button', { name: 'Reset' }).click()

        await expect.element(page.getByRole('dialog')).not.toBeInTheDocument()
        expect(filtersInState()).toEqual([foreign])
    })

    it('adds an unpinned chip from the menu and removes it when cleared', async () => {
        await renderFilters([nameFilter, districtFilter])

        await page.getByRole('button', { name: 'Filter' }).click()
        await page.getByRole('menuitem', { name: 'District' }).click()

        const dialog = page.getByRole('dialog', { name: 'District' })
        await expect.element(dialog).toBeVisible()
        await expect.element(chip('District')).toBeVisible()
        // Every filter is shown, so there is nothing left to add.
        await expect
            .element(page.getByRole('button', { name: 'Filter' }))
            .not.toBeInTheDocument()
        await dialog.getByText('Kenema').click()
        await dialog.getByRole('button', { name: 'Apply' }).click()

        await expect.element(chip('District: Kenema')).toBeVisible()
        expect(filtersInState()).toEqual([
            foreign,
            { id: 'district', value: { kind: 'options', values: ['Kenema'] } },
        ])

        await page.getByRole('button', { name: 'Clear District' }).click()

        await expect.element(chip('District')).not.toBeInTheDocument()
        expect(filtersInState()).toEqual([foreign])
        await expect
            .element(page.getByRole('button', { name: 'Filter' }))
            .toHaveFocus()
    })

    it('drops an added chip that is dismissed without a value', async () => {
        await renderFilters([nameFilter, districtFilter])

        await page.getByRole('button', { name: 'Filter' }).click()
        await page.getByRole('menuitem', { name: 'District' }).click()
        await expect
            .element(page.getByRole('dialog', { name: 'District' }))
            .toBeVisible()
        await userEvent.keyboard('{Escape}')

        await expect.element(chip('District')).not.toBeInTheDocument()
        expect(filtersInState()).toEqual([foreign])
    })

    it('offers the operators the filter allows and hides the value for "Is empty"', async () => {
        await renderFilters([
            { ...nameFilter, operators: ['contains', 'startsWith', 'empty'] },
        ])

        await chip('Name').click()
        await page.getByRole('combobox', { name: 'Match' }).click()
        await expect
            .element(page.getByRole('option', { name: 'Starts with' }))
            .toBeVisible()
        await expect
            .element(page.getByRole('option', { name: 'Is exactly' }))
            .not.toBeInTheDocument()
        await page.getByRole('option', { name: 'Is empty' }).click()
        await expect
            .element(page.getByLabelText('Value'))
            .not.toBeInTheDocument()
        await page.getByRole('button', { name: 'Apply' }).click()

        expect(filtersInState()).toEqual([
            foreign,
            {
                id: 'name',
                value: { kind: 'text', operator: 'empty', text: '' },
            },
        ])
        await expect.element(chip('Name: Is empty')).toBeVisible()
    })

    it('"Clear filters" resets the column filters', async () => {
        await renderFilters([nameFilter, districtFilter])

        await expect
            .element(page.getByRole('button', { name: 'Clear filters' }))
            .not.toBeInTheDocument()
        await chip('Name').click()
        await userEvent.fill(page.getByLabelText('Value'), 'Amina')
        await userEvent.keyboard('{Enter}')
        const clearAll = page.getByRole('button', { name: 'Clear filters' })
        await expect
            .element(clearAll)
            .toHaveAttribute('data-slot', 'data-table-clear-filters')

        await clearAll.click()

        expect(filtersInState()).toEqual([])
        await expect.element(chip('Name')).toBeVisible()
        await expect.element(clearAll).not.toBeInTheDocument()
        // The button left with the click; focus goes to "Filter".
        await expect
            .element(page.getByRole('button', { name: 'Filter' }))
            .toHaveFocus()
    })

    it('moves focus to the first chip when every filter is shown', async () => {
        await renderFilters([nameFilter])

        await chip('Name').click()
        await userEvent.fill(page.getByLabelText('Value'), 'Amina')
        await userEvent.keyboard('{Enter}')
        await page.getByRole('button', { name: 'Clear filters' }).click()

        await expect.element(chip('Name')).toHaveFocus()
    })
})
