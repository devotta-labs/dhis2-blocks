import React from 'react'
import { render } from 'vitest-browser-react'
import {
    createFakeServer,
    FakeServerRuntime,
    fakeProgram,
    silent,
} from '../../__tests__/fakeServer'
import { WorkingListTable } from '../Results'
import { WorkingListToolbar } from '../Toolbar'
import { WorkingList, WorkingListViewSwitcher } from '../WorkingList'
import { WorkingListTableSkeleton } from '../WorkingListTable'

describe('WorkingList structural components', () => {
    it('renders page-sized skeleton rows with disabled shadcn pagination', async () => {
        const screen = await render(<WorkingListTableSkeleton pageSize={15} />)

        expect(
            screen.container.querySelectorAll(
                '[data-test="working-list-skeleton-row"]'
            )
        ).toHaveLength(15)
        expect(
            screen.container.querySelectorAll('[data-slot="table-head"]')
        ).toHaveLength(4)
        expect(
            screen.container.querySelectorAll(
                '[data-test="working-list-pagination"] button:not(:disabled)'
            )
        ).toHaveLength(0)
    })

    it('provides localized accessible defaults and forwards native props', async () => {
        const server = createFakeServer({ resources: { programs: silent } })
        const screen = await render(
            <FakeServerRuntime server={server}>
                <WorkingList programId="Program0001" orgUnitId="OrgUnit0001">
                    <WorkingListViewSwitcher
                        className="views-class"
                        data-consumer="views"
                    />
                    <WorkingListToolbar
                        className="toolbar-class"
                        data-consumer="toolbar"
                    >
                        <span>Controls</span>
                    </WorkingListToolbar>
                    <WorkingListTable
                        className="table-class"
                        data-consumer="table"
                    />
                </WorkingList>
            </FakeServerRuntime>
        )

        await expect
            .element(
                screen.getByRole('region', {
                    name: 'Saved views in this program',
                })
            )
            .toBeVisible()
        const viewSwitcher = screen.container.querySelector<HTMLElement>(
            '[data-testid="working-list-view-switcher"]'
        )
        const heading = viewSwitcher?.querySelector('h2')
        expect(viewSwitcher?.getAttribute('aria-labelledby')).toBe(heading?.id)
        expect(viewSwitcher?.className).toBe('views-class')
        expect(viewSwitcher?.dataset.consumer).toBe('views')

        await expect
            .element(
                screen.getByRole('toolbar', { name: 'Working list controls' })
            )
            .toBeVisible()
        const toolbar = screen.container.querySelector<HTMLElement>(
            '[data-testid="working-list-toolbar"]'
        )
        expect(toolbar?.className).toContain('toolbar-class')
        expect(toolbar?.dataset.consumer).toBe('toolbar')

        await expect
            .element(
                screen.getByRole('region', { name: 'Working list results' })
            )
            .toBeVisible()
        const table = screen.container.querySelector<HTMLElement>(
            '[data-testid="working-list-table-section"]'
        )
        expect(table?.tagName).toBe('SECTION')
        expect(table?.className).toBe('table-class')
        expect(table?.dataset.consumer).toBe('table')
    })

    it('keeps composed parts visible while initializing and hides them on fatal errors', async () => {
        let answer: (program: typeof fakeProgram) => void = () => undefined
        const server = createFakeServer({
            resources: {
                programs: () =>
                    new Promise((resolve) => {
                        answer = resolve
                    }),
            },
        })
        const screen = await render(
            <FakeServerRuntime server={server}>
                <WorkingList programId="Program0001" orgUnitId="OrgUnit0001">
                    <span data-testid="composed-child">Child</span>
                </WorkingList>
            </FakeServerRuntime>
        )

        await expect
            .element(screen.getByTestId('working-list-initializing'))
            .toHaveTextContent('Loading the working list…')

        const frame = screen.container.querySelector(
            '[data-testid="working-list"]'
        )

        expect(frame?.hasAttribute('hidden')).toBe(false)
        expect(frame?.getAttribute('aria-busy')).toBe('true')
        await expect.element(screen.getByTestId('composed-child')).toBeVisible()

        // The block lists tracked entities; an event program has none.
        answer({ ...fakeProgram, programType: 'WITHOUT_REGISTRATION' })
        await expect
            .element(screen.getByTestId('working-list-lifecycle-error'))
            .toBeVisible()
        expect(frame?.hasAttribute('hidden')).toBe(true)
        expect(
            screen.container.querySelector(
                '[data-testid="working-list-initializing"]'
            )
        ).toBeNull()
    })
})
