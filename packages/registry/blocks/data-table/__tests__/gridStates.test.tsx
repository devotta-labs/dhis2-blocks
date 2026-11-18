import type { ReactNode } from 'react'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import {
    createDataTableColumnHelper,
    DataTable,
    DataTableContent,
    useDataTable,
    type DataTableColumnDef,
    type DataTableState,
    type DataTableStatus,
} from '..'
import {
    StateProbe,
    makePeople,
    personColumns,
    type Person,
} from './dataTableTestSupport'

const people = makePeople(25)

const Harness = ({
    data = people,
    status,
    error,
    onRetry,
    emptyState,
    initialState,
    columns = personColumns,
}: {
    columns?: DataTableColumnDef<Person>[]
    data?: Person[]
    status?: DataTableStatus
    error?: ReactNode
    onRetry?: () => void
    emptyState?: ReactNode
    initialState?: Partial<DataTableState>
}) => {
    const table = useDataTable({
        data,
        columns,
        getRowId: (person) => person.id,
        initialState,
    })
    return (
        <DataTable
            table={table}
            label="People"
            status={status}
            error={error}
            onRetry={onRetry}
        >
            <StateProbe />
            <DataTableContent emptyState={emptyState} />
        </DataTable>
    )
}

const body = () => {
    const element = document.querySelector('[data-slot="data-table-body"]')
    if (element === null) throw new Error('No table body')
    return element
}

const count = (selector: string) => document.querySelectorAll(selector).length

const state = () =>
    JSON.parse(page.getByTestId('state').element().textContent ?? '{}')

const noMatches = {
    columnFilters: [
        {
            id: 'name',
            value: { kind: 'text', operator: 'contains', text: 'nobody' },
        },
    ],
}

describe('DataTableBody states', () => {
    it('shows skeleton rows while loading, busy and hidden', async () => {
        await render(<Harness status="loading" />)
        await expect
            .element(page.getByRole('table', { name: 'People' }))
            .toBeVisible()
        expect(body().getAttribute('aria-busy')).toBe('true')
        expect(count('[data-slot="data-table-skeleton"]')).toBe(10)
        expect(
            count('[data-slot="data-table-skeleton"][aria-hidden="true"]')
        ).toBe(10)
        expect(count('[data-slot="data-table-row"]')).toBe(0)
        expect(
            page.getByRole('table', { name: 'People' }).element()
        ).not.toHaveAttribute('aria-rowcount')
    })

    it('draws no more skeleton rows than a page holds', async () => {
        await render(
            <Harness
                status="loading"
                initialState={{ pagination: { pageIndex: 0, pageSize: 5 } }}
            />
        )
        await expect
            .element(page.getByRole('table', { name: 'People' }))
            .toBeVisible()
        expect(count('[data-slot="data-table-skeleton"]')).toBe(5)
    })

    it('aligns each skeleton bar like its column', async () => {
        const column = createDataTableColumnHelper<Person>()
        const columns = [
            column.accessor('name', { header: 'Name' }),
            column.accessor('age', { header: 'Age', meta: { align: 'end' } }),
            column.accessor('active', {
                header: 'Active',
                meta: { align: 'center' },
            }),
        ]
        await render(<Harness status="loading" columns={columns} />)
        await expect
            .element(page.getByRole('table', { name: 'People' }))
            .toBeVisible()
        const cells = Array.from(
            document.querySelectorAll(
                '[data-slot="data-table-skeleton"]:first-child > td'
            ),
            (cell) => {
                const bar = cell.querySelector('[data-slot="skeleton"]')
                if (bar === null) throw new Error('No skeleton bar')
                const style = getComputedStyle(cell)
                const box = cell.getBoundingClientRect()
                return {
                    left: box.left + parseFloat(style.paddingLeft),
                    right: box.right - parseFloat(style.paddingRight),
                    bar: bar.getBoundingClientRect(),
                }
            }
        )
        expect(cells).toHaveLength(3)
        const [start, end, center] = cells
        expect(Math.abs(start.bar.left - start.left)).toBeLessThan(1)
        expect(Math.abs(end.bar.right - end.right)).toBeLessThan(1)
        expect(
            Math.abs(
                (center.bar.left + center.bar.right) / 2 -
                    (center.left + center.right) / 2
            )
        ).toBeLessThan(1)
    })

    it('keeps the rows while updating, marked busy', async () => {
        await render(<Harness status="updating" />)
        await expect
            .element(page.getByRole('cell', { name: 'Amina 1' }))
            .toBeVisible()
        expect(body().getAttribute('aria-busy')).toBe('true')
        expect(body().classList.contains('opacity-80')).toBe(true)
        expect(count('[data-slot="data-table-row"]')).toBe(10)
    })

    it('is not busy when ready', async () => {
        await render(<Harness />)
        await expect
            .element(page.getByRole('cell', { name: 'Amina 1' }))
            .toBeVisible()
        expect(body().getAttribute('aria-busy')).toBe('false')
    })

    it('shows the error with a Retry button that calls onRetry', async () => {
        let retries = 0
        await render(
            <Harness
                status="error"
                onRetry={() => {
                    retries += 1
                }}
            />
        )
        await expect
            .element(page.getByText('The list could not be loaded.'))
            .toBeVisible()
        expect(count('[data-slot="data-table-error"]')).toBe(1)
        await userEvent.click(page.getByRole('button', { name: 'Retry' }))
        expect(retries).toBe(1)
    })

    it('shows the caller’s error and no Retry without onRetry', async () => {
        await render(<Harness status="error" error="The server is down." />)
        await expect
            .element(page.getByText('The server is down.'))
            .toBeVisible()
        await expect
            .element(page.getByRole('button', { name: 'Retry' }))
            .not.toBeInTheDocument()
    })

    it('shows the empty state when there are no rows and no filters', async () => {
        await render(<Harness data={[]} />)
        await expect
            .element(page.getByText('No items to display'))
            .toBeVisible()
        expect(count('[data-slot="data-table-empty"]')).toBe(1)
        await expect
            .element(page.getByRole('button', { name: 'Clear filters' }))
            .not.toBeInTheDocument()
    })

    it('shows a custom empty state', async () => {
        await render(<Harness data={[]} emptyState={<p>Nobody yet</p>} />)
        await expect.element(page.getByText('Nobody yet')).toBeVisible()
        await expect
            .element(page.getByText('No items to display'))
            .not.toBeInTheDocument()
    })

    it('shows "no results" when filters hide every row, and clears both filter slices', async () => {
        await render(
            <Harness
                emptyState={<p>Nobody yet</p>}
                initialState={{ ...noMatches, globalFilter: 'nobody' }}
            />
        )
        await expect
            .element(page.getByText('No results match your filters'))
            .toBeVisible()
        await expect
            .element(page.getByText('Nobody yet'))
            .not.toBeInTheDocument()

        await userEvent.click(
            page.getByRole('button', { name: 'Clear filters' })
        )
        await expect
            .element(page.getByRole('cell', { name: 'Amina 1' }))
            .toBeVisible()
        expect(state().columnFilters).toEqual([])
        expect(state().globalFilter ?? '').toBe('')
    })

    it('counts a global filter alone as a filter', async () => {
        await render(<Harness initialState={{ globalFilter: 'nobody' }} />)
        await expect
            .element(page.getByText('No results match your filters'))
            .toBeVisible()
    })
})
