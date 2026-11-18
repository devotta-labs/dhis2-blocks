import axe from 'axe-core'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import {
    DataTable,
    DataTableContent,
    DataTablePagination,
    createDataTableColumnHelper,
    dataTableExpanderColumn,
    useDataTable,
    type DataTableDensity,
    type DataTableRow,
    type DataTableState,
    type DataTableStatus,
} from '..'
import { makePeople, personColumns, type Person } from './dataTableTestSupport'

const people = makePeople(25)
const noPeople: Person[] = []
const column = createDataTableColumnHelper<Person>()

const columns = column.columns([
    dataTableExpanderColumn<Person>(),
    ...personColumns,
    column.accessor('age', {
        id: 'total',
        header: 'Total age',
        footer: ({ table }) =>
            table
                .getRowModel()
                .rows.reduce((sum, row) => sum + row.original.age, 0),
    }),
])

const noMatches: Partial<DataTableState> = {
    globalFilter: 'nobody',
}

// A landmark, as on a page; popovers portal outside it.
const Harness = ({
    data = people,
    status,
    initialState,
    density,
}: {
    data?: Person[]
    status?: DataTableStatus
    initialState?: Partial<DataTableState>
    density?: DataTableDensity
}) => {
    const table = useDataTable({
        data,
        columns,
        getRowId: (person) => person.id,
        getRowCanExpand: () => true,
        initialState,
    })
    return (
        <main>
            <DataTable
                table={table}
                label="People"
                layout="fixed"
                defaultDensity={density}
                status={status}
                onRetry={() => undefined}
            >
                <DataTableContent
                    columnMenu
                    onRowOpen={() => undefined}
                    renderExpandedRow={(row: DataTableRow<Person>) => (
                        <p>Details for {row.original.name}</p>
                    )}
                    maxHeight={480}
                    stickyHeader
                />
                <DataTablePagination />
            </DataTable>
        </main>
    )
}

const violations = async (skip: readonly string[] = []) =>
    (
        await axe.run(document.body, {
            rules: Object.fromEntries(
                skip.map((rule) => [rule, { enabled: false }])
            ),
        })
    ).violations

const table = () => page.getByRole('table', { name: 'People' })

const WCAG_22_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

describe('grid accessibility', () => {
    it('has no axe violations with rows, menus, resizing and a footer', async () => {
        await render(<Harness />)
        await expect
            .element(page.getByRole('cell', { name: 'Amina 1', exact: true }))
            .toBeVisible()
        expect(await violations()).toEqual([])
    })

    it.each(['compact', 'normal', 'comfortable'] as const)(
        'meets WCAG 2.2 AA, target size included, in %s density',
        async (density) => {
            await render(<Harness density={density} />)
            await expect
                .element(page.getByRole('button', { name: 'Resize Name' }))
                .toBeInTheDocument()
            const { violations: found } = await axe.run(document.body, {
                runOnly: { type: 'tag', values: WCAG_22_AA },
            })
            expect(found).toEqual([])
        }
    )

    it('has no axe violations with a row expanded', async () => {
        await render(<Harness />)
        await userEvent.click(
            page.getByRole('button', { name: 'Expand row 1', exact: true })
        )
        await expect
            .element(page.getByText('Details for Amina 1'))
            .toBeVisible()
        expect(await violations()).toEqual([])
    })

    it('has no axe violations with a column menu open', async () => {
        await render(<Harness />)
        await userEvent.click(
            page.getByRole('button', { name: 'Options for Name' })
        )
        await expect.element(page.getByRole('menu')).toBeVisible()
        // The shared dropdown menu portals to <body>, outside every landmark.
        expect(await violations(['region'])).toEqual([])
    })

    it('has no axe violations while loading', async () => {
        await render(<Harness status="loading" />)
        await expect.element(table()).toBeVisible()
        expect(await violations()).toEqual([])
    })

    it('has no axe violations while updating', async () => {
        await render(<Harness status="updating" />)
        await expect
            .element(page.getByRole('cell', { name: 'Amina 1', exact: true }))
            .toBeVisible()
        expect(await violations()).toEqual([])
    })

    it('has no axe violations in the error state', async () => {
        await render(<Harness status="error" />)
        await expect
            .element(page.getByRole('button', { name: 'Retry' }))
            .toBeVisible()
        expect(await violations()).toEqual([])
    })

    it('has no axe violations in the empty state', async () => {
        await render(<Harness data={noPeople} />)
        await expect
            .element(page.getByText('No items to display'))
            .toBeVisible()
        expect(await violations()).toEqual([])
    })

    it('has no axe violations when filters hide every row', async () => {
        await render(<Harness initialState={noMatches} />)
        await expect
            .element(page.getByRole('button', { name: 'Clear filters' }))
            .toBeVisible()
        expect(await violations()).toEqual([])
    })
})
