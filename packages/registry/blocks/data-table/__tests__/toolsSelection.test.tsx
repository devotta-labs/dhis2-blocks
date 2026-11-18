import { useState } from 'react'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { Checkbox } from '@/components/dhis2/ui/checkbox'
import { DropdownMenuItem } from '@/components/dhis2/ui/dropdown-menu'
import {
    DATA_TABLE_SELECT_COLUMN_ID,
    DataTable,
    DataTableContent,
    DataTableFilters,
    DataTableRowActions,
    DataTableSelectionBar,
    createDataTableColumnHelper,
    dataTableSelectionColumn,
    useDataTable,
    type DataTableColumnDef,
    type DataTableFilter,
} from '..'
import { roleColour } from '../../../test/roleColour'
import { makePeople, personColumns, type Person } from './dataTableTestSupport'
import { ToolsHarness, toolsState } from './toolsTestSupport'

const columns: DataTableColumnDef<Person>[] = [
    dataTableSelectionColumn<Person>(),
    ...personColumns,
]

const selectAll = () =>
    page.getByRole('checkbox', { name: 'Select all rows on this page' })
const rowBox = (index: number) =>
    page.getByRole('checkbox', { name: `Select row ${index + 1}`, exact: true })
const selectedIds = () => Object.keys(toolsState().rowSelection)
const bar = () => page.getByRole('region', { name: 'Selection' })

const twelvePeople = makePeople(12)
const nameFilter: DataTableFilter[] = [
    { id: 'name', label: 'Name', kind: 'text' },
]

/** The real grid, filters and a bar whose bulk action clears the selection. */
const ContentHarness = ({
    selectColumn = true,
}: {
    selectColumn?: boolean
}) => {
    const table = useDataTable({
        data: twelvePeople,
        columns: selectColumn ? columns : personColumns,
        getRowId: (person) => person.id,
        initialState: { rowSelection: { 'person-2': true } },
    })
    return (
        <DataTable table={table} label="People">
            <DataTableFilters filters={nameFilter} />
            <DataTableSelectionBar>
                <button
                    type="button"
                    onClick={() => table.resetRowSelection(true)}
                >
                    Archive
                </button>
            </DataTableSelectionBar>
            <DataTableContent />
        </DataTable>
    )
}

const AllMatchingHarness = ({
    onIds,
}: {
    onIds?: (ids: readonly string[]) => void
}) => {
    const [allMatching, setAllMatching] = useState(false)
    return (
        <ToolsHarness columns={columns}>
            <DataTableSelectionBar
                totalMatching={12}
                allMatching={allMatching}
                onAllMatchingChange={setAllMatching}
            >
                {(ids) => {
                    onIds?.(ids)
                    return (
                        <button type="button">
                            Delete {allMatching ? 'all' : ids.length}
                        </button>
                    )
                }}
            </DataTableSelectionBar>
        </ToolsHarness>
    )
}

describe('dataTableSelectionColumn', () => {
    it('is a fixed utility column', () => {
        const column = dataTableSelectionColumn<Person>()
        expect(column.id).toBe(DATA_TABLE_SELECT_COLUMN_ID)
        expect(column.size).toBe(44)
        expect(column.enableSorting).toBe(false)
        expect(column.enableHiding).toBe(false)
        expect(column.enableResizing).toBe(false)
        expect(column.enableGrouping).toBe(false)
        expect(column.meta?.label).toBe('Select')
    })

    it('selects rows, and every row on the page from the header', async () => {
        await render(<ToolsHarness columns={columns} />)

        await expect.element(selectAll()).not.toBeChecked()
        await rowBox(1).click()

        await expect.element(rowBox(1)).toBeChecked()
        expect(selectedIds()).toEqual(['person-2'])
        await expect
            .element(selectAll())
            .toHaveAttribute('aria-checked', 'mixed')

        await selectAll().click()

        await expect.element(selectAll()).toBeChecked()
        expect(selectedIds()).toHaveLength(10)
        await expect.element(rowBox(9)).toBeChecked()

        await selectAll().click()
        expect(selectedIds()).toEqual([])
        await expect.element(rowBox(1)).not.toBeChecked()
    })

    it('draws the header box filled, with a bar, while some rows are selected', async () => {
        await render(<ToolsHarness columns={columns} />)
        await rowBox(1).click()

        await expect
            .element(selectAll())
            .toHaveAttribute('aria-checked', 'mixed')
        await expect.element(selectAll()).toHaveAttribute('data-indeterminate')
        const box = selectAll().element()
        expect(getComputedStyle(box).backgroundColor).toBe(
            roleColour('selected-strong')
        )
        expect(getComputedStyle(box).borderTopColor).toBe(
            roleColour('selected-foreground')
        )
        const indicator = box.querySelector('[data-slot="checkbox-indicator"]')
        const checkmark = indicator?.querySelector('svg')
        const bar = indicator?.querySelector('span')
        if (!checkmark || !bar) throw new Error('No indicator parts')
        expect(getComputedStyle(checkmark).display).toBe('none')
        const { width, height } = bar.getBoundingClientRect()
        expect([width, height]).toEqual([10, 2])
        expect(getComputedStyle(bar).backgroundColor).toBe(
            getComputedStyle(box).color
        )

        // Checked: the checkmark, not the bar.
        await selectAll().click()
        await expect.element(selectAll()).toBeChecked()
        const checked = selectAll().element()
        expect(
            checked.querySelector('svg')?.getBoundingClientRect().width
        ).toBe(16)
        const hiddenBar = checked.querySelector(
            '[data-slot="checkbox-indicator"] span'
        )
        if (!hiddenBar) throw new Error('No bar')
        expect(getComputedStyle(hiddenBar).display).toBe('none')
    })

    it('greys a disabled indeterminate box like a disabled checked one', async () => {
        await render(
            <>
                <Checkbox aria-label="Some" indeterminate disabled />
                <Checkbox aria-label="All" checked disabled />
            </>
        )
        const some = page.getByRole('checkbox', { name: 'Some' }).element()
        const all = page.getByRole('checkbox', { name: 'All' }).element()

        expect(getComputedStyle(some).backgroundColor).toBe(
            roleColour('accent-strong')
        )
        expect(getComputedStyle(some).borderTopColor).toBe(
            getComputedStyle(all).borderTopColor
        )
    })

    it('selects a range with Shift', async () => {
        await render(<ToolsHarness columns={columns} />)

        await rowBox(1).click()
        await userEvent.click(rowBox(4), { modifiers: ['Shift'] })

        expect(selectedIds().sort()).toEqual([
            'person-2',
            'person-3',
            'person-4',
            'person-5',
        ])
        await expect.element(rowBox(3)).toBeChecked()
    })

    it('selects no page text on a Shift-click and focuses the box', async () => {
        await render(<ToolsHarness columns={columns} />)

        await rowBox(1).click()
        await userEvent.click(rowBox(6), { modifiers: ['Shift'] })

        expect(selectedIds()).toHaveLength(6)
        expect(window.getSelection()?.toString()).toBe('')
        await expect.element(rowBox(6)).toHaveFocus()
    })

    it('disables rows that cannot be selected', async () => {
        await render(
            <ToolsHarness
                columns={columns}
                options={{ enableRowSelection: (row) => row.original.active }}
            />
        )

        // Person 1 is inactive.
        await expect.element(rowBox(0)).toHaveAttribute('aria-disabled', 'true')
        await expect.element(rowBox(1)).not.toHaveAttribute('aria-disabled')
    })
})

describe('DataTableSelectionBar', () => {
    it('shows nothing until a row is selected, then the count and actions', async () => {
        await render(
            <ToolsHarness columns={columns}>
                <DataTableSelectionBar>
                    <button type="button">Export</button>
                </DataTableSelectionBar>
            </ToolsHarness>
        )

        await expect.element(bar()).not.toBeInTheDocument()
        await rowBox(0).click()
        await rowBox(2).click()

        await expect
            .element(bar())
            .toHaveAttribute('data-slot', 'data-table-selection-bar')
        await expect.element(bar()).toHaveTextContent('2 selected')
        await expect
            .element(bar().getByRole('button', { name: 'Export' }))
            .toBeVisible()
        // No total given: nothing more to select.
        await expect
            .element(bar().getByRole('button', { name: /Select all/ }))
            .not.toBeInTheDocument()

        await bar().getByRole('button', { name: 'Clear selection' }).click()

        expect(selectedIds()).toEqual([])
        await expect.element(bar()).not.toBeInTheDocument()
    })

    it('offers every matching row once the page is selected', async () => {
        const seen: (readonly string[])[] = []
        await render(<AllMatchingHarness onIds={(ids) => seen.push(ids)} />)

        await rowBox(0).click()
        await expect
            .element(bar().getByRole('button', { name: 'Select all 12' }))
            .not.toBeInTheDocument()
        await selectAll().click()
        await expect.element(bar()).toHaveTextContent('10 selected')
        expect(seen.at(-1)).toHaveLength(10)

        await bar().getByRole('button', { name: 'Select all 12' }).click()

        await expect.element(bar()).toHaveTextContent('All 12 selected')
        await expect
            .element(bar().getByRole('button', { name: 'Delete all' }))
            .toBeVisible()
        await expect
            .element(bar().getByRole('button', { name: 'Select all 12' }))
            .not.toBeInTheDocument()

        // A change by hand ends "every matching row".
        await rowBox(0).click()

        await expect.element(bar()).toHaveTextContent('9 selected')
        await expect
            .element(bar().getByRole('button', { name: 'Delete 9' }))
            .toBeVisible()
    })

    it('Clear selection also ends "every matching row"', async () => {
        await render(<AllMatchingHarness />)

        await selectAll().click()
        await bar().getByRole('button', { name: 'Select all 12' }).click()
        await expect.element(bar()).toHaveTextContent('All 12 selected')

        await bar().getByRole('button', { name: 'Clear selection' }).click()

        expect(selectedIds()).toEqual([])
        await expect.element(bar()).not.toBeInTheDocument()
    })

    it('hands focus to the header checkbox when it goes away', async () => {
        await render(<ContentHarness />)

        await bar().getByRole('button', { name: 'Clear selection' }).click()

        await expect.element(bar()).not.toBeInTheDocument()
        await expect.element(selectAll()).toHaveFocus()

        await rowBox(3).click()
        await bar().getByRole('button', { name: 'Archive' }).click()

        await expect.element(bar()).not.toBeInTheDocument()
        await expect.element(selectAll()).toHaveFocus()
    })

    it('hands focus to the Filter button without a select column', async () => {
        await render(<ContentHarness selectColumn={false} />)

        await bar().getByRole('button', { name: 'Clear selection' }).click()

        await expect.element(bar()).not.toBeInTheDocument()
        await expect
            .element(page.getByRole('button', { name: 'Filter' }))
            .toHaveFocus()
    })
})

describe('DataTableRowActions', () => {
    it('opens a menu of row actions and runs one', async () => {
        const opened: string[] = []
        const column = createDataTableColumnHelper<Person>()
        await render(
            <ToolsHarness
                columns={[
                    ...personColumns,
                    column.display({
                        id: 'actions',
                        enableHiding: false,
                        cell: ({ row }) => (
                            <DataTableRowActions
                                label={`Actions for ${row.original.name}`}
                            >
                                <DropdownMenuItem
                                    onClick={() => opened.push(row.id)}
                                >
                                    Open
                                </DropdownMenuItem>
                            </DataTableRowActions>
                        ),
                    }),
                ]}
            />
        )

        const trigger = page.getByRole('button', {
            name: 'Actions for Bakary 2',
        })
        await expect
            .element(trigger)
            .toHaveAttribute('data-slot', 'data-table-row-actions')
        await trigger.click()
        await page.getByRole('menuitem', { name: 'Open' }).click()

        expect(opened).toEqual(['person-2'])
        await expect
            .element(page.getByRole('menuitem', { name: 'Open' }))
            .not.toBeInTheDocument()
    })

    it('is named "Row actions" by default', async () => {
        const column = createDataTableColumnHelper<Person>()
        await render(
            <ToolsHarness
                data={[]}
                columns={[
                    column.display({
                        id: 'actions',
                        header: () => (
                            <DataTableRowActions>
                                <DropdownMenuItem>Open</DropdownMenuItem>
                            </DataTableRowActions>
                        ),
                    }),
                ]}
            />
        )

        await expect
            .element(page.getByRole('button', { name: 'Row actions' }))
            .toBeVisible()
    })
})
