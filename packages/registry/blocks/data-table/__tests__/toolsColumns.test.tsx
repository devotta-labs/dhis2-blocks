import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import {
    DataTableColumnSettings,
    DataTableDensityToggle,
    dataTableSelectionColumn,
} from '..'
import { personColumns, type Person } from './dataTableTestSupport'
import { ToolsHarness, toolsState } from './toolsTestSupport'

const openSettings = async () => {
    const button = page.getByRole('button', { name: 'Columns' })
    await expect
        .element(button)
        .toHaveAttribute('data-slot', 'data-table-column-settings')
    await button.click()
    const dialog = page.getByRole('dialog', { name: 'Columns' })
    await expect.element(dialog).toBeVisible()
    return dialog
}

const listedIds = () =>
    Array.from(
        document.querySelectorAll('[data-slot="data-table-column-setting"]'),
        (row) => row.getAttribute('data-column-id')
    )

const headers = () =>
    Array.from(document.querySelectorAll('thead th'), (th) => th.textContent)

describe('DataTableColumnSettings', () => {
    it('lists the columns in order and hides and shows them', async () => {
        await render(
            <ToolsHarness>
                <DataTableColumnSettings />
            </ToolsHarness>
        )
        const dialog = await openSettings()

        expect(listedIds()).toEqual([
            'name',
            'age',
            'district',
            'registered',
            'active',
        ])
        const age = dialog.getByRole('checkbox', { name: 'Age' })
        await expect.element(age).toBeChecked()
        await age.click()

        await expect.element(age).not.toBeChecked()
        expect(toolsState().columnVisibility).toEqual({ age: false })
        expect(headers()).toEqual(['Name', 'District', 'Registered', 'Active'])

        await age.click()
        expect(toolsState().columnVisibility).toEqual({ age: true })
    })

    it('keeps the last visible column', async () => {
        await render(
            <ToolsHarness>
                <DataTableColumnSettings />
            </ToolsHarness>
        )
        const dialog = await openSettings()

        for (const name of ['Name', 'Age', 'District', 'Registered']) {
            await dialog.getByRole('checkbox', { name }).click()
        }

        const active = dialog.getByRole('checkbox', { name: 'Active' })
        await expect.element(active).toBeChecked()
        await expect.element(active).toHaveAttribute('aria-disabled', 'true')
        expect(headers()).toEqual(['Active'])

        await dialog.getByRole('checkbox', { name: 'Name' }).click()
        await expect.element(active).not.toHaveAttribute('aria-disabled')
    })

    it('moves columns, keeping focus on the button used', async () => {
        await render(
            <ToolsHarness>
                <DataTableColumnSettings />
            </ToolsHarness>
        )
        const dialog = await openSettings()

        const nameUp = dialog.getByRole('button', { name: 'Move Name up' })
        await expect.element(nameUp).toBeDisabled()
        const ageUp = dialog.getByRole('button', { name: 'Move Age up' })
        await ageUp.click()

        expect(toolsState().columnOrder).toEqual([
            'age',
            'name',
            'district',
            'registered',
            'active',
        ])
        expect(listedIds()[0]).toBe('age')
        expect(headers()[0]).toBe('Age')
        await expect.element(ageUp).toHaveFocus()
        // At the top now: disabled, yet still focused.
        await expect.element(ageUp).toBeDisabled()

        await userEvent.tab()
        const ageDown = dialog.getByRole('button', { name: 'Move Age down' })
        await expect.element(ageDown).toHaveFocus()
        await userEvent.keyboard('{Enter}')
        await userEvent.keyboard('{Enter}')

        expect(toolsState().columnOrder).toEqual([
            'name',
            'district',
            'age',
            'registered',
            'active',
        ])
        await expect.element(ageDown).toHaveFocus()
        await expect
            .element(dialog.getByRole('button', { name: 'Move Active down' }))
            .toBeDisabled()
    })

    it('resets visibility and order', async () => {
        await render(
            <ToolsHarness>
                <DataTableColumnSettings label="Show columns" />
            </ToolsHarness>
        )
        await page.getByRole('button', { name: 'Show columns' }).click()
        const dialog = page.getByRole('dialog', { name: 'Columns' })
        await dialog.getByRole('checkbox', { name: 'District' }).click()
        await dialog.getByRole('button', { name: 'Move Active up' }).click()
        expect(toolsState().columnVisibility).toEqual({ district: false })
        expect(toolsState().columnOrder).not.toEqual([])

        await dialog.getByRole('button', { name: 'Reset' }).click()

        expect(toolsState().columnVisibility).toEqual({})
        expect(toolsState().columnOrder).toEqual([])
        await expect
            .element(dialog.getByRole('checkbox', { name: 'District' }))
            .toBeChecked()
    })

    it('leaves out the selection column and keeps it first', async () => {
        await render(
            <ToolsHarness
                columns={[dataTableSelectionColumn<Person>(), ...personColumns]}
            >
                <DataTableColumnSettings />
            </ToolsHarness>
        )
        const dialog = await openSettings()

        expect(listedIds()).not.toContain('select')
        await dialog.getByRole('button', { name: 'Move Age up' }).click()

        expect(toolsState().columnOrder).toEqual([
            'select',
            'age',
            'name',
            'district',
            'registered',
            'active',
        ])
    })
})

describe('DataTableColumnSettings with pinned columns', () => {
    it('lists columns in table order and moves only unpinned ones', async () => {
        await render(
            <ToolsHarness
                options={{
                    initialState: {
                        columnPinning: { start: ['district'], end: ['name'] },
                    },
                }}
            >
                <DataTableColumnSettings />
            </ToolsHarness>
        )
        const dialog = await openSettings()

        expect(listedIds()).toEqual([
            'district',
            'age',
            'registered',
            'active',
            'name',
        ])
        expect(headers()).toEqual([
            'District',
            'Age',
            'Registered',
            'Active',
            'Name',
        ])
        for (const id of ['district', 'name']) {
            const row = document.querySelector(
                `[data-slot="data-table-column-setting"][data-column-id="${id}"]`
            )
            expect(row?.querySelectorAll('[data-move]')).toHaveLength(0)
            expect(row?.textContent).toContain('Pinned')
        }
        await expect
            .element(dialog.getByRole('checkbox', { name: 'Name' }))
            .toBeChecked()
        await expect
            .element(dialog.getByRole('button', { name: 'Move Age up' }))
            .toBeDisabled()
        await expect
            .element(dialog.getByRole('button', { name: 'Move Active down' }))
            .toBeDisabled()

        await dialog.getByRole('button', { name: 'Move Registered up' }).click()

        expect(listedIds()).toEqual([
            'district',
            'registered',
            'age',
            'active',
            'name',
        ])
        expect(headers()).toEqual([
            'District',
            'Registered',
            'Age',
            'Active',
            'Name',
        ])
        await expect
            .element(dialog.getByRole('button', { name: 'Move Registered up' }))
            .toBeDisabled()

        await dialog.getByRole('button', { name: 'Move Age down' }).click()

        expect(headers()).toEqual([
            'District',
            'Registered',
            'Active',
            'Age',
            'Name',
        ])
    })
})

describe('DataTableDensityToggle', () => {
    it('sets the density of the table', async () => {
        await render(
            <ToolsHarness>
                <DataTableDensityToggle />
            </ToolsHarness>
        )
        const root = () => document.querySelector('[data-slot="data-table"]')
        expect(root()?.getAttribute('data-density')).toBe('normal')

        const button = page.getByRole('button', { name: 'Density' })
        await expect
            .element(button)
            .toHaveAttribute('data-slot', 'data-table-density')
        await button.click()
        await expect
            .element(page.getByRole('menuitemradio', { name: 'Normal' }))
            .toBeChecked()
        await page.getByRole('menuitemradio', { name: 'Compact' }).click()

        await expect
            .poll(() => root()?.getAttribute('data-density'))
            .toBe('compact')
    })

    it('closes when a density is chosen and gives focus back', async () => {
        await render(
            <ToolsHarness>
                <DataTableDensityToggle />
            </ToolsHarness>
        )
        const button = page.getByRole('button', { name: 'Density' })
        await button.click()
        await page.getByRole('menuitemradio', { name: 'Comfortable' }).click()

        await expect.element(page.getByRole('menu')).not.toBeInTheDocument()
        await expect.element(button).toHaveFocus()

        // From the keyboard too.
        await userEvent.keyboard('{Enter}')
        await expect.element(page.getByRole('menu')).toBeVisible()
        await userEvent.keyboard('{Enter}')
        await expect.element(page.getByRole('menu')).not.toBeInTheDocument()
        await expect.element(button).toHaveFocus()
    })
})
