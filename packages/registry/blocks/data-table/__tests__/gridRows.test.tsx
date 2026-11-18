import { useState } from 'react'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import {
    createDataTableColumnHelper,
    DATA_TABLE_EXPAND_COLUMN_ID,
    DataTable,
    DataTableContent,
    dataTableExpanderColumn,
    useDataTable,
    type DataTableRow,
} from '..'
import { makePeople, personColumns, type Person } from './dataTableTestSupport'

const column = createDataTableColumnHelper<Person>()

// Module-level data: a new `data` array on each render would reset the
// table's expanded state.
const fivePeople = makePeople(5)
const threePeople = makePeople(3)
const tenPeople = makePeople(10)
const manyPeople = makePeople(2000)

const rowCount = () =>
    document.querySelectorAll('tr[data-slot="data-table-row"]').length

describe('expandable rows', () => {
    const Expanding = () => {
        const table = useDataTable({
            data: fivePeople,
            columns: [dataTableExpanderColumn<Person>(), ...personColumns],
            getRowId: (person) => person.id,
            getRowCanExpand: () => true,
        })
        return (
            <DataTable table={table} label="People">
                <DataTableContent
                    renderExpandedRow={(row: DataTableRow<Person>) => (
                        <p>Details for {row.original.name}</p>
                    )}
                />
            </DataTable>
        )
    }

    it('expands a row to its detail and collapses it again', async () => {
        await render(<Expanding />)
        const expand = page.getByRole('button', { name: 'Expand row 2' })
        await expect.element(expand).toHaveAttribute('aria-expanded', 'false')
        expect(
            document.querySelector('[data-slot="data-table-row-detail"]')
        ).toBeNull()

        await userEvent.click(expand)
        const collapse = page.getByRole('button', { name: 'Collapse row 2' })
        await expect.element(collapse).toHaveAttribute('aria-expanded', 'true')
        const detail = document.querySelector(
            '[data-slot="data-table-row-detail"]'
        )
        expect(detail?.textContent).toBe('Details for Bakary 2')
        expect(
            detail?.previousElementSibling?.getAttribute('data-row-id')
        ).toBe('person-2')
        expect(detail?.querySelector('td')?.colSpan).toBe(6)

        await userEvent.click(collapse)
        await expect
            .element(page.getByText('Details for Bakary 2'))
            .not.toBeInTheDocument()
    })

    it('gives the expander column a hidden header and no sort or resize', async () => {
        await render(<Expanding />)
        const expanderHeader = document.querySelector(
            `th[data-column-id="${DATA_TABLE_EXPAND_COLUMN_ID}"]`
        )
        expect(expanderHeader?.textContent).toBe('Expand')
        expect(expanderHeader?.getAttribute('aria-sort')).toBeNull()
        expect(
            expanderHeader?.querySelector('[data-slot="data-table-sort"]')
        ).toBeNull()
    })

    it('shows no expander on a row that cannot expand', async () => {
        const NoDetail = () => {
            const table = useDataTable({
                data: threePeople,
                columns: [dataTableExpanderColumn<Person>(), ...personColumns],
                getRowId: (person) => person.id,
            })
            return (
                <DataTable table={table} label="People">
                    <DataTableContent />
                </DataTable>
            )
        }
        await render(<NoDetail />)
        await expect
            .element(page.getByRole('cell', { name: 'Amina 1' }))
            .toBeVisible()
        expect(
            document.querySelector('[data-slot="data-table-expander"]')
        ).toBeNull()
    })
})

describe('grouped rows', () => {
    const Grouped = () => {
        const table = useDataTable({
            data: tenPeople,
            columns: column.columns([
                column.accessor('name', { header: 'Name' }),
                column.accessor('age', {
                    header: 'Age',
                    aggregationFn: 'sum',
                    aggregatedCell: ({ getValue }) => `Total ${getValue()}`,
                }),
                column.accessor('district', {
                    header: 'District',
                    enableGrouping: true,
                }),
            ]),
            getRowId: (person) => person.id,
            initialState: { grouping: ['district'] },
        })
        return (
            <DataTable table={table} label="People">
                <DataTableContent onRowOpen={() => undefined} />
            </DataTable>
        )
    }

    it('renders one row per group with its count and aggregated cells', async () => {
        await render(<Grouped />)
        const bo = page.getByRole('button', { name: 'Bo (2)' })
        await expect.element(bo).toHaveAttribute('aria-expanded', 'false')
        expect(rowCount()).toBe(5)
        // Bo holds people 1 (age 18) and 6 (age 53).
        await expect.element(page.getByText('Total 71')).toBeVisible()
        expect(
            document.querySelector('[data-slot="data-table-row-open"]')
        ).toBeNull()

        await userEvent.click(bo)
        await expect.element(bo).toHaveAttribute('aria-expanded', 'true')
        expect(rowCount()).toBe(7)
        await expect
            .element(page.getByRole('cell', { name: 'Amina 1' }))
            .toBeVisible()
        await expect
            .element(page.getByRole('button', { name: 'Open row 2' }))
            .toBeInTheDocument()
    })

    it('counts the leaf rows of a group that holds groups', async () => {
        const Nested = () => {
            const table = useDataTable({
                data: tenPeople,
                columns: column.columns([
                    column.accessor('name', { header: 'Name' }),
                    column.accessor('district', {
                        header: 'District',
                        enableGrouping: true,
                    }),
                    column.accessor('active', {
                        header: 'Active',
                        enableGrouping: true,
                    }),
                ]),
                getRowId: (person) => person.id,
                initialState: { grouping: ['district', 'active'] },
            })
            return (
                <DataTable table={table} label="People">
                    <DataTableContent />
                </DataTable>
            )
        }
        await render(<Nested />)
        // Kailahun holds people 3 and 8, both active: one group of two.
        // Bo holds person 1 (inactive) and 6 (active): two groups of one.
        await expect
            .element(page.getByRole('button', { name: 'Kailahun (2)' }))
            .toBeVisible()
        await expect
            .element(page.getByRole('button', { name: 'Bo (2)', exact: true }))
            .toBeVisible()
    })
})

describe('virtualized rows', () => {
    const Virtual = () => {
        const table = useDataTable({
            data: manyPeople,
            columns: personColumns,
            getRowId: (person) => person.id,
            initialState: { pagination: { pageIndex: 0, pageSize: 2000 } },
        })
        return (
            <DataTable table={table} label="People">
                <DataTableContent maxHeight={400} virtualized stickyHeader />
            </DataTable>
        )
    }

    const amina = () => page.getByRole('cell', { name: 'Amina 1', exact: true })

    const container = () => {
        const element = document.querySelector<HTMLElement>(
            '[data-slot="table-container"]'
        )
        if (element === null) throw new Error('No table container')
        return element
    }

    it('draws far fewer rows than it has and follows the scroll', async () => {
        await render(<Virtual />)
        await expect.element(amina()).toBeVisible()
        expect(rowCount()).toBeGreaterThan(0)
        expect(rowCount()).toBeLessThan(60)
        await expect
            .element(page.getByRole('table', { name: 'People' }))
            .toHaveAttribute('aria-rowcount', '2001')
        expect(getComputedStyle(container()).maxHeight).toBe('400px')

        container().scrollTop = 48 * 1000
        await expect.element(amina()).not.toBeInTheDocument()
        await expect
            .poll(() => {
                const first = document.querySelector(
                    'tr[data-slot="data-table-row"]'
                )
                return Number(first?.getAttribute('aria-rowindex'))
            })
            .toBeGreaterThan(900)
        expect(rowCount()).toBeLessThan(60)
    })

    it('goes back to the top when the query changes, not when the data does', async () => {
        const Requerying = () => {
            const [data, setData] = useState(manyPeople)
            const table = useDataTable({
                data,
                columns: personColumns,
                getRowId: (person) => person.id,
                initialState: { pagination: { pageIndex: 0, pageSize: 2000 } },
            })
            const actions = {
                Reload: () => setData((current) => [...current]),
                Sort: () => table.setSorting([{ id: 'age', desc: true }]),
                Search: () => table.setGlobalFilter('Amina'),
                Filter: () =>
                    table.setColumnFilters([
                        {
                            id: 'district',
                            value: {
                                kind: 'text',
                                operator: 'contains',
                                text: 'Bo',
                            },
                        },
                    ]),
                Group: () => table.setGrouping(['name']),
            }
            return (
                <>
                    {Object.entries(actions).map(([name, action]) => (
                        <button key={name} type="button" onClick={action}>
                            {name}
                        </button>
                    ))}
                    <DataTable table={table} label="People">
                        <DataTableContent
                            maxHeight={400}
                            virtualized
                            stickyHeader
                        />
                    </DataTable>
                </>
            )
        }
        const nextFrames = () =>
            new Promise((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(resolve))
            )
        await render(<Requerying />)
        await expect.element(amina()).toBeVisible()

        // Measuring the drawn rows can shift the offset a little.
        container().scrollTop = 48 * 50
        await expect.element(amina()).not.toBeInTheDocument()
        await page.getByRole('button', { name: 'Reload' }).click()
        await nextFrames()
        expect(container().scrollTop).toBeGreaterThan(48 * 40)

        for (const name of ['Sort', 'Search', 'Filter', 'Group']) {
            container().scrollTop = 48 * 20
            await expect.poll(() => container().scrollTop).toBeGreaterThan(0)
            await page.getByRole('button', { name, exact: true }).click()
            await expect.poll(() => container().scrollTop).toBe(0)
        }
    })

    it('keeps the header in view while the rows scroll', async () => {
        await render(<Virtual />)
        const header = page.getByRole('columnheader', { name: 'Name' })
        await expect.element(header).toBeVisible()
        const top = container().getBoundingClientRect().top
        container().scrollTop = 48 * 50
        await expect.element(amina()).not.toBeInTheDocument()
        // The table's 1px top border scrolls away; the header stays put.
        const headerTop = header.element().getBoundingClientRect().top
        expect(Math.abs(headerTop - top)).toBeLessThanOrEqual(1)
    })
})
