import type { ReactNode } from 'react'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { DataTableContent } from '@/components/data-table'
import {
    PATIENT_LIST_FIELDS,
    PatientList,
    usePatientList,
    type PatientListRow,
} from '..'
import {
    FIRST_NAME,
    ORG_UNIT,
    PROGRAM,
    PatientListProviders,
    createFakeServer,
    requestsFiltering,
    testColumns,
    testFilters,
    type FakeServer,
} from './patientListTestSupport'

const List = ({
    onRowOpen,
    children,
}: {
    onRowOpen?: (row: PatientListRow) => void
    children?: ReactNode
}) => {
    const list = usePatientList({
        program: PROGRAM,
        orgUnit: ORG_UNIT,
        columns: testColumns,
        filters: testFilters,
    })
    return (
        <main>
            <PatientList list={list} onRowOpen={onRowOpen}>
                {children}
            </PatientList>
        </main>
    )
}

const renderList = (
    server: FakeServer,
    props: {
        onRowOpen?: (row: PatientListRow) => void
        children?: ReactNode
    } = {}
) =>
    render(
        <PatientListProviders server={server}>
            <List {...props} />
        </PatientListProviders>
    )

const cell = (name: string) => page.getByRole('cell', { name, exact: true })
const pageInfo = () =>
    page.getByRole('navigation', { name: 'Pagination' }).getByText(/^Page \d+$/)
const next = () => page.getByRole('button', { name: 'Next' })
const firstNames = () =>
    [...document.querySelectorAll('tr[data-slot="data-table-row"]')].map(
        (row) => row.querySelector('td')?.textContent
    )

describe('PatientList', () => {
    it('shows the first page with formatted cells', async () => {
        const server = createFakeServer()
        await renderList(server)

        await expect.element(cell('Amina 01')).toBeVisible()
        const first = document.querySelector('tr[data-row-id="te01"]')
        expect(
            [...(first?.querySelectorAll('td') ?? [])].map(
                (td) => td.textContent
            )
        ).toEqual(['Amina 01', 'BANGURA', '2024-06-30', 'ACTIVE'])
        expect(firstNames()).toHaveLength(15)
        await expect
            .element(page.getByRole('table', { name: 'Patient list' }))
            .toBeVisible()
        await expect.element(pageInfo()).toHaveTextContent('Page 1')
    })

    it('asks for one page of the program in the organisation unit', async () => {
        const server = createFakeServer()
        await renderList(server)
        await expect.element(cell('Amina 01')).toBeVisible()

        expect(server.requests).toHaveLength(1)
        expect(server.requests[0]).toEqual({
            program: PROGRAM,
            orgUnits: ORG_UNIT,
            orgUnitMode: 'SELECTED',
            page: 1,
            pageSize: 15,
            order: 'createdAt:desc',
            fields: PATIENT_LIST_FIELDS,
        })
    })

    it('marks its root and leaves out the global search', async () => {
        const server = createFakeServer()
        await renderList(server)
        await expect.element(cell('Amina 01')).toBeVisible()

        const root = document.querySelector('[data-block="patient-list"]')
        expect(root?.getAttribute('data-slot')).toBe('data-table')
        expect(root?.getAttribute('data-status')).toBe('ready')
        expect(
            document.querySelector('[data-slot="data-table-search"]')
        ).toBeNull()
        await expect
            .element(page.getByRole('searchbox'))
            .not.toBeInTheDocument()
    })

    it('moves to the next page, and marks Next disabled on the last one', async () => {
        const server = createFakeServer()
        await renderList(server)
        await expect.element(cell('Amina 01')).toBeVisible()

        await userEvent.click(next())
        await expect.element(cell('Esi 16')).toBeVisible()
        await expect.element(pageInfo()).toHaveTextContent('Page 2')
        expect(server.requests.at(-1)).toMatchObject({ page: 2 })

        await userEvent.click(next())
        await expect.element(cell('Ibrahim 31')).toBeVisible()
        await expect.element(pageInfo()).toHaveTextContent('Page 3')
        expect(firstNames()).toHaveLength(10)
        await expect.element(next()).toHaveAttribute('aria-disabled', 'true')
        // Still focusable, so focus is not lost on the last page.
        next().element().focus()
        await expect.element(next()).toHaveFocus()
        await userEvent.keyboard('{Enter}')
        await expect.element(pageInfo()).toHaveTextContent('Page 3')
        expect(server.requests.map((params) => params.page)).toEqual([1, 2, 3])
    })

    it('sorts on the server from the first page', async () => {
        const server = createFakeServer()
        await renderList(server)
        await expect.element(cell('Amina 01')).toBeVisible()
        await userEvent.click(next())
        await expect.element(cell('Esi 16')).toBeVisible()

        await userEvent.click(
            page.getByRole('button', { name: 'First name', exact: true })
        )

        await expect.element(pageInfo()).toHaveTextContent('Page 1')
        await expect
            .poll(() => firstNames().slice(0, 4))
            .toEqual(['Amina 01', 'Amina 12', 'Amina 23', 'Amina 34'])
        const sorted = server.requests.filter(
            (params) => params.order === `${FIRST_NAME}:asc`
        )
        expect(sorted.map((params) => params.page)).toEqual([1])
    })

    it('filters on the server from the first page', async () => {
        const server = createFakeServer()
        await renderList(server)
        await expect.element(cell('Amina 01')).toBeVisible()
        await userEvent.click(next())
        await expect.element(cell('Esi 16')).toBeVisible()

        await page.getByRole('combobox', { name: 'First name' }).click()
        const dialog = page.getByRole('dialog', { name: 'First name' })
        await userEvent.fill(dialog.getByLabelText('Value'), 'amina')
        await dialog.getByRole('button', { name: 'Apply' }).click()

        await expect.element(pageInfo()).toHaveTextContent('Page 1')
        await expect
            .poll(firstNames)
            .toEqual(['Amina 01', 'Amina 12', 'Amina 23', 'Amina 34'])
        await expect.element(next()).toHaveAttribute('aria-disabled', 'true')
        const filtered = requestsFiltering(server, `${FIRST_NAME}:like:amina`)
        expect(filtered.map((params) => params.page)).toEqual([1])
    })

    it('shows the server message with Retry, and Retry recovers', async () => {
        const server = createFakeServer()
        server.failure = 'You have no access to this program'
        await renderList(server)

        await expect
            .element(page.getByText('You have no access to this program'))
            .toBeVisible()
        expect(
            document
                .querySelector('[data-block="patient-list"]')
                ?.getAttribute('data-status')
        ).toBe('error')

        server.failure = undefined
        await page.getByRole('button', { name: 'Retry' }).click()
        await expect.element(cell('Amina 01')).toBeVisible()
    })

    it('opens a row with the tracked entity row', async () => {
        const server = createFakeServer()
        const opened: PatientListRow[] = []
        await renderList(server, { onRowOpen: (row) => opened.push(row) })
        const open = page.getByRole('button', { name: 'Open row 2' })
        await expect.element(open).toBeInTheDocument()

        open.element().focus()
        await userEvent.keyboard('{Enter}')
        expect(opened).toHaveLength(1)
        expect(opened[0]).toMatchObject({
            trackedEntity: 'te02',
            attributes: { [FIRST_NAME]: 'Bakary 02' },
            enrollment: { enrollment: 'en02', status: 'COMPLETED' },
        })
    })

    it('replaces the layout with its children', async () => {
        const server = createFakeServer()
        await renderList(server, { children: <DataTableContent /> })
        await expect.element(cell('Amina 01')).toBeVisible()

        await expect
            .element(page.getByRole('navigation', { name: 'Pagination' }))
            .not.toBeInTheDocument()
        await expect.element(page.getByRole('toolbar')).not.toBeInTheDocument()
        await expect
            .element(page.getByRole('combobox', { name: 'First name' }))
            .not.toBeInTheDocument()
    })
})
