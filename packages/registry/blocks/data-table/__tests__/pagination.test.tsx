import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import {
    DataTable,
    DataTableContent,
    DataTablePagination,
    useDataTable,
    type DataTableStatus,
} from '..'
import {
    StateProbe,
    makePeople,
    personColumns,
    type Person,
} from './dataTableTestSupport'

const twentyFive = makePeople(25)
const noPeople: Person[] = []
const fullPage = makePeople(10)
const shortPage = makePeople(5)

const ClientHarness = ({
    data = twentyFive,
    status,
    pageSize = 10,
    pageSizes,
}: {
    data?: Person[]
    status?: DataTableStatus
    pageSize?: number
    pageSizes?: readonly number[]
}) => {
    const table = useDataTable({
        data,
        columns: personColumns,
        getRowId: (person) => person.id,
        initialState: { pagination: { pageIndex: 0, pageSize } },
    })
    return (
        <DataTable table={table} label="People" status={status}>
            <StateProbe />
            <DataTableContent />
            <DataTablePagination pageSizes={pageSizes} />
        </DataTable>
    )
}

const ServerHarness = ({
    data,
    rowCount,
    hasNextPage,
}: {
    data: Person[]
    rowCount?: number
    hasNextPage?: boolean
}) => {
    const table = useDataTable({
        mode: 'server',
        data,
        columns: personColumns,
        getRowId: (person) => person.id,
        rowCount,
    })
    return (
        <DataTable table={table} label="People" hasNextPage={hasNextPage}>
            <DataTableContent />
            <DataTablePagination />
        </DataTable>
    )
}

// The page info: "Page n", "a–b of n" or "No rows".
const info = () =>
    page
        .getByRole('navigation', { name: 'Pagination' })
        .getByText(/^(Page \d+|\d+–\d+ of \d+|No rows)$/)
const previous = () => page.getByRole('button', { name: 'Previous' })
const next = () => page.getByRole('button', { name: 'Next' })
const pageSize = () => page.getByRole('combobox', { name: 'Rows per page' })

const state = () =>
    JSON.parse(page.getByTestId('state').element().textContent ?? '{}')

describe('DataTablePagination (client)', () => {
    it('shows the range and moves between pages', async () => {
        await render(<ClientHarness />)
        await expect.element(info()).toHaveTextContent('1–10 of 25')
        await expect.element(previous()).toBeDisabled()
        await expect.element(next()).toBeEnabled()

        await userEvent.click(next())
        await expect.element(info()).toHaveTextContent('11–20 of 25')
        await expect.element(previous()).toBeEnabled()
        await expect
            .element(page.getByRole('cell', { name: 'Kofi 11' }))
            .toBeVisible()

        await userEvent.click(next())
        await expect.element(info()).toHaveTextContent('21–25 of 25')
        await expect.element(next()).toBeDisabled()

        await userEvent.click(previous())
        await expect.element(info()).toHaveTextContent('11–20 of 25')
    })

    it('says "No rows" when there are none', async () => {
        await render(<ClientHarness data={noPeople} />)
        await expect.element(info()).toHaveTextContent('No rows')
        await expect.element(previous()).toBeDisabled()
        await expect.element(next()).toBeDisabled()
    })

    it('changes the page size', async () => {
        await render(<ClientHarness />)
        await expect.element(pageSize()).toHaveTextContent('10')
        await userEvent.click(pageSize())
        await userEvent.click(page.getByRole('option', { name: '25' }))
        await expect.element(info()).toHaveTextContent('1–25 of 25')
        expect(state().pagination).toEqual({ pageIndex: 0, pageSize: 25 })
        expect(
            document.querySelectorAll('tr[data-slot="data-table-row"]')
        ).toHaveLength(25)
    })

    it('offers the current page size when it is not in the list', async () => {
        await render(<ClientHarness pageSize={15} pageSizes={[10, 20]} />)
        await expect.element(pageSize()).toHaveTextContent('15')
        await userEvent.click(pageSize())
        await expect
            .element(page.getByRole('option', { name: '20' }))
            .toBeVisible()
        const options = page
            .getByRole('option')
            .all()
            .map((option) => option.element().textContent)
        expect(options).toEqual(['10', '15', '20'])
    })

    it('disables every control while loading', async () => {
        await render(<ClientHarness status="loading" />)
        await expect.element(previous()).toBeDisabled()
        await expect.element(next()).toBeDisabled()
        await expect.element(pageSize()).toBeDisabled()
    })

    it('keeps disabled buttons focusable', async () => {
        await render(<ClientHarness />)
        await expect.element(previous()).toBeDisabled()
        previous().element().focus()
        await expect.element(previous()).toHaveFocus()
    })
})

describe('without DataTablePagination', () => {
    it('shows every row with an endless page size', async () => {
        const AllRows = () => {
            const table = useDataTable({
                data: twentyFive,
                columns: personColumns,
                getRowId: (person) => person.id,
                initialState: {
                    pagination: { pageIndex: 0, pageSize: Infinity },
                },
            })
            return (
                <DataTable table={table} label="People">
                    <DataTableContent />
                </DataTable>
            )
        }
        await render(<AllRows />)
        await expect
            .element(page.getByRole('cell', { name: 'Chidi 25' }))
            .toBeVisible()
        expect(
            document.querySelectorAll('tr[data-slot="data-table-row"]')
        ).toHaveLength(25)
        const last = document.querySelector(
            'tr[data-slot="data-table-row"]:last-child'
        )
        expect(last?.getAttribute('aria-rowindex')).toBe('26')
    })
})

describe('DataTablePagination (server)', () => {
    it('shows only the page number when the total is unknown', async () => {
        await render(<ServerHarness data={fullPage} hasNextPage />)
        await expect.element(info()).toHaveTextContent('Page 1')
        await expect.element(next()).toBeEnabled()
        await userEvent.click(next())
        await expect.element(info()).toHaveTextContent('Page 2')
        await expect.element(previous()).toBeEnabled()
    })

    it('follows hasNextPage when it is given', async () => {
        await render(<ServerHarness data={fullPage} hasNextPage={false} />)
        await expect.element(info()).toHaveTextContent('Page 1')
        await expect.element(next()).toBeDisabled()
    })

    it('guesses from a full page without hasNextPage', async () => {
        const { unmount } = await render(<ServerHarness data={fullPage} />)
        await expect.element(next()).toBeEnabled()
        unmount()

        await render(<ServerHarness data={shortPage} />)
        await expect.element(info()).toHaveTextContent('Page 1')
        await expect.element(next()).toBeDisabled()
    })

    it('shows the range when the server gives a row count', async () => {
        await render(<ServerHarness data={fullPage} rowCount={42} />)
        await expect.element(info()).toHaveTextContent('1–10 of 42')
        await expect.element(next()).toBeEnabled()
    })
})
