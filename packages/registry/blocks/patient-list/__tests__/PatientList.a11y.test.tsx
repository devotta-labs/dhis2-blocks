import axe from 'axe-core'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { PatientList, usePatientList } from '..'
import {
    ORG_UNIT,
    PROGRAM,
    PatientListProviders,
    createFakeServer,
    testColumns,
    testFilters,
    type FakeServer,
} from './patientListTestSupport'

// A landmark, as on a page.
const List = () => {
    const list = usePatientList({
        program: PROGRAM,
        orgUnit: ORG_UNIT,
        columns: testColumns,
        filters: testFilters,
    })
    return (
        <main>
            <PatientList list={list} onRowOpen={() => undefined} />
        </main>
    )
}

const renderList = (server: FakeServer) =>
    render(
        <PatientListProviders server={server}>
            <List />
        </PatientListProviders>
    )

const violations = async () => (await axe.run(document.body)).violations

describe('PatientList accessibility', () => {
    it('has no axe violations once loaded', async () => {
        await renderList(createFakeServer())
        await expect
            .element(
                page.getByRole('button', { name: 'Open row 1', exact: true })
            )
            .toBeInTheDocument()
        await expect
            .element(page.getByRole('combobox', { name: 'First name' }))
            .toBeVisible()
        expect(await violations()).toEqual([])
    })

    it('has no axe violations in the error state', async () => {
        const server = createFakeServer()
        server.failure = 'You have no access to this program'
        await renderList(server)
        await expect
            .element(page.getByRole('button', { name: 'Retry' }))
            .toBeVisible()
        expect(await violations()).toEqual([])
    })
})
