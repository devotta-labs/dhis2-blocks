import axe from 'axe-core'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { DropdownMenuItem } from '@/components/dhis2/ui/dropdown-menu'
import {
    DataTableColumnSettings,
    DataTableDensityToggle,
    DataTableExportButton,
    DataTableFilters,
    DataTableRowActions,
    DataTableSearch,
    DataTableSelectionBar,
    DataTableToolbar,
    createDataTableColumnHelper,
    dataTableSelectionColumn,
    type DataTableFilter,
} from '..'
import { personColumns, type Person } from './dataTableTestSupport'
import { ToolsHarness } from './toolsTestSupport'

const filters: DataTableFilter[] = [
    {
        id: 'name',
        kind: 'text',
        label: 'Name',
        pinned: true,
        operators: ['contains', 'equals'],
    },
    { id: 'age', kind: 'number', label: 'Age', pinned: true },
    {
        id: 'district',
        kind: 'options',
        label: 'District',
        pinned: true,
        multiple: true,
        options: [
            { value: 'Bo', label: 'Bo' },
            { value: 'Kenema', label: 'Kenema' },
        ],
    },
    { id: 'active', kind: 'boolean', label: 'Active' },
]

const column = createDataTableColumnHelper<Person>()

// A landmark, as on a page; popovers portal outside it.
const Tools = () => (
    <main>
        <ToolsHarness
            columns={[
                dataTableSelectionColumn<Person>(),
                ...personColumns,
                column.display({
                    id: 'actions',
                    header: 'Actions',
                    enableHiding: false,
                    cell: () => (
                        <DataTableRowActions>
                            <DropdownMenuItem>Open</DropdownMenuItem>
                        </DataTableRowActions>
                    ),
                }),
            ]}
            options={{
                initialState: {
                    rowSelection: { 'person-1': true },
                    columnFilters: [
                        { id: 'age', value: { kind: 'number', min: 18 } },
                    ],
                },
            }}
        >
            <DataTableToolbar>
                <DataTableSearch />
                <DataTableFilters filters={filters} />
                <DataTableColumnSettings />
                <DataTableDensityToggle />
                <DataTableExportButton filename="people" />
            </DataTableToolbar>
            <DataTableSelectionBar>
                <button type="button">Delete</button>
            </DataTableSelectionBar>
        </ToolsHarness>
    </main>
)

const violations = async () => (await axe.run(document.body)).violations

describe('tools accessibility', () => {
    it('has no axe violations in the toolbar and selection bar', async () => {
        await render(<Tools />)
        await expect.element(page.getByRole('toolbar')).toBeVisible()

        expect(await violations()).toEqual([])
    })

    it('has no axe violations with a filter popover open', async () => {
        await render(<Tools />)
        await page.getByRole('combobox', { name: 'Name', exact: true }).click()
        await expect
            .element(page.getByRole('dialog', { name: 'Name' }))
            .toBeVisible()

        expect(await violations()).toEqual([])
    })

    it('has no axe violations with the options filter open', async () => {
        await render(<Tools />)
        await page
            .getByRole('combobox', { name: 'District', exact: true })
            .click()
        await expect
            .element(page.getByRole('dialog', { name: 'District' }))
            .toBeVisible()

        expect(await violations()).toEqual([])
    })

    it('has no axe violations with column settings open', async () => {
        await render(<Tools />)
        await page.getByRole('button', { name: 'Columns' }).click()
        await expect
            .element(page.getByRole('dialog', { name: 'Columns' }))
            .toBeVisible()

        expect(await violations()).toEqual([])
    })
})
