import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import {
    createDataTableColumnHelper,
    DataTable,
    DataTableContent,
    useDataTable,
    type DataTableColumnDef,
    type DataTableContentProps,
    type DataTableRow,
    type UseDataTableOptions,
} from '..'
import { makePeople, personColumns, type Person } from './dataTableTestSupport'

type HarnessProps = Omit<DataTableContentProps<Person>, 'children'> & {
    columns?: DataTableColumnDef<Person>[]
    options?: Omit<UseDataTableOptions<Person>, 'data' | 'columns' | 'getRowId'>
}

const people = makePeople(25)
const column = createDataTableColumnHelper<Person>()

const Harness = ({
    columns = personColumns,
    options,
    ...content
}: HarnessProps) => {
    const table = useDataTable({
        data: people,
        columns,
        getRowId: (person) => person.id,
        ...options,
    })
    return (
        <DataTable table={table} label="People">
            <DataTableContent {...content} />
        </DataTable>
    )
}

const header = (name: string) => page.getByRole('columnheader', { name })

const firstNames = () =>
    [
        ...document.querySelectorAll(
            '[data-slot="data-table-row"] [data-column-id="name"]'
        ),
    ]
        .slice(0, 2)
        .map((cell) => cell.textContent)

const rowElement = (rowId: string) => {
    const element = document.querySelector(`tr[data-row-id="${rowId}"]`)
    if (element === null) throw new Error(`No row ${rowId}`)
    return element
}

describe('DataTableContent', () => {
    it('renders the header and the first page of rows', async () => {
        await render(<Harness />)
        await expect
            .element(page.getByRole('table', { name: 'People' }))
            .toBeVisible()
        expect(page.getByRole('columnheader').all()).toHaveLength(5)
        expect(
            document.querySelectorAll('tr[data-slot="data-table-row"]')
        ).toHaveLength(10)
        expect(firstNames()).toEqual(['Amina 1', 'Bakary 2'])
    })

    it('cycles aria-sort ascending, descending, none when the header is clicked', async () => {
        await render(<Harness />)
        const name = header('Name')
        await expect.element(name).toHaveAttribute('aria-sort', 'none')

        await userEvent.click(page.getByRole('button', { name: 'Name' }))
        await expect.element(name).toHaveAttribute('aria-sort', 'ascending')
        expect(firstNames()).toEqual(['Amina 1', 'Amina 12'])

        await userEvent.click(page.getByRole('button', { name: 'Name' }))
        await expect.element(name).toHaveAttribute('aria-sort', 'descending')
        expect(firstNames()).toEqual(['Kofi 22', 'Kofi 11'])

        await userEvent.click(page.getByRole('button', { name: 'Name' }))
        await expect.element(name).toHaveAttribute('aria-sort', 'none')
        expect(firstNames()).toEqual(['Amina 1', 'Bakary 2'])
    })

    it('leaves aria-sort off a column that cannot sort', async () => {
        const columns = [
            column.accessor('name', { header: 'Name', enableSorting: false }),
        ]
        await render(<Harness columns={columns} />)
        await expect.element(header('Name')).not.toHaveAttribute('aria-sort')
        expect(
            document.querySelector('[data-slot="data-table-sort"]')
        ).toBeNull()
    })

    it('aligns the header and cells from meta.align', async () => {
        await render(<Harness />)
        await expect.element(header('Age')).toHaveClass('text-end')
        const ageCell = document.querySelector('td[data-column-id="age"]')
        expect(ageCell?.classList.contains('text-end')).toBe(true)
        await expect.element(header('Name')).toHaveClass('text-start')
    })

    it('keeps cells on one line with meta.nowrap', async () => {
        const columns = [
            column.accessor('name', { header: 'Name', meta: { nowrap: true } }),
        ]
        await render(<Harness columns={columns} />)
        const cell = document.querySelector('td[data-column-id="name"]')
        if (cell === null) throw new Error('No name cell')
        expect(getComputedStyle(cell).whiteSpace).toBe('nowrap')
    })

    it('sets aria-rowcount on the table and aria-rowindex on the rows', async () => {
        await render(
            <Harness
                options={{
                    initialState: {
                        pagination: { pageIndex: 1, pageSize: 10 },
                    },
                }}
            />
        )
        await expect
            .element(page.getByRole('table', { name: 'People' }))
            .toHaveAttribute('aria-rowcount', '26')
        expect(rowElement('person-11').getAttribute('aria-rowindex')).toBe('12')
        expect(
            document.querySelector('thead tr')?.getAttribute('aria-rowindex')
        ).toBe('1')
    })

    it('opens a row when it is clicked', async () => {
        const opened: string[] = []
        const onRowOpen = (row: DataTableRow<Person>) =>
            opened.push(row.original.name)
        await render(<Harness onRowOpen={onRowOpen} />)
        await userEvent.click(page.getByRole('cell', { name: 'Bakary 2' }))
        expect(opened).toEqual(['Bakary 2'])
        expect(
            rowElement('person-2').classList.contains('cursor-pointer')
        ).toBe(true)
    })

    it('opens a row from its hidden button with Enter and Space', async () => {
        const opened: string[] = []
        await render(
            <Harness onRowOpen={(row) => opened.push(row.original.name)} />
        )
        page.getByRole('button', { name: 'Open row 3' }).element().focus()
        await userEvent.keyboard('{Enter}')
        await userEvent.keyboard(' ')
        expect(opened).toEqual(['Chidi 3', 'Chidi 3'])
    })

    it('shows a focus ring on the row while its open button has keyboard focus', async () => {
        await render(<Harness onRowOpen={() => undefined} />)
        page.getByRole('button', { name: 'Active' }).element().focus()
        await userEvent.tab()
        await expect
            .element(
                page.getByRole('button', { name: 'Open row 1', exact: true })
            )
            .toHaveFocus()
        expect(getComputedStyle(rowElement('person-1')).outlineStyle).toBe(
            'solid'
        )
    })

    it('names the open buttons with rowOpenLabel', async () => {
        await render(
            <Harness
                onRowOpen={() => undefined}
                rowOpenLabel={(row) => `Open ${row.original.name}`}
            />
        )
        await expect
            .element(page.getByRole('button', { name: 'Open Chidi 3' }))
            .toBeInTheDocument()
    })

    it('does not open the row when a control inside it is clicked', async () => {
        const opened: string[] = []
        const edited: string[] = []
        const columns = [
            ...personColumns,
            column.display({
                id: 'edit',
                header: 'Edit',
                cell: ({ row }) => (
                    <button
                        type="button"
                        onClick={() => edited.push(row.original.name)}
                    >
                        Edit {row.original.name}
                    </button>
                ),
            }),
        ]
        await render(
            <Harness
                columns={columns}
                onRowOpen={(row) => opened.push(row.original.name)}
            />
        )
        await userEvent.click(page.getByRole('button', { name: 'Edit Esi 5' }))
        expect(edited).toEqual(['Esi 5'])
        expect(opened).toEqual([])
    })

    it('does not make rows openable without onRowOpen', async () => {
        await render(<Harness />)
        await expect
            .element(page.getByRole('cell', { name: 'Amina 1' }))
            .toBeVisible()
        expect(
            document.querySelector('[data-slot="data-table-row-open"]')
        ).toBeNull()
    })

    it('renders the footer only when a column defines one', async () => {
        const { unmount } = await render(<Harness />)
        await expect
            .element(page.getByRole('cell', { name: 'Amina 1' }))
            .toBeVisible()
        expect(document.querySelector('[data-slot="data-table-footer"]')).toBe(
            null
        )
        unmount()

        const columns = [
            column.accessor('name', { header: 'Name', footer: 'Total' }),
            column.accessor('age', {
                header: 'Age',
                footer: ({ table }) =>
                    table
                        .getRowModel()
                        .rows.reduce((sum, row) => sum + row.original.age, 0),
            }),
        ]
        await render(<Harness columns={columns} />)
        const footer = page.getByRole('rowgroup').last()
        await expect.element(footer).toHaveTextContent('Total')
        expect(
            document.querySelector('[data-slot="data-table-footer"]')
        ).not.toBeNull()
    })
})
