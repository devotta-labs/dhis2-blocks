import React from 'react'
import { render } from 'vitest-browser-react'
import { WorkingListProvider } from '../../provider/WorkingListProvider'
import {
    readyWorkingListData,
    WorkingListTestRuntime,
    workingListTestQueryClient,
    WORKING_LIST_PROGRAM,
} from '../../test/WorkingListTestRuntime'
import { WorkingListViewSwitcher } from '../WorkingList'
import { WorkingListContainer } from '../Container'
import { WorkingListTable } from '../Results'
import { WorkingListToolbar } from '../Toolbar'
import { WorkingListTableSkeleton } from '../WorkingListTable'

const controlledProps = {
    programId: WORKING_LIST_PROGRAM,
    orgUnitId: 'OrgUnit00001',
    selectedSavedListId: null,
    pagination: { page: 1, pageSize: 15 } as const,
}

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
                '[data-test="working-list-pagination"] button:not([data-disabled])'
            )
        ).toHaveLength(0)
    })

    it('provides localized accessible defaults and forwards native props', async () => {
        const { data } = readyWorkingListData()
        const screen = await render(
            <WorkingListTestRuntime
                client={workingListTestQueryClient()}
                data={data}
            >
                <WorkingListProvider
                    {...controlledProps}
                    onSelectedSavedListChange={vi.fn()}
                    onPaginationChange={vi.fn()}
                >
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
                </WorkingListProvider>
            </WorkingListTestRuntime>
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
        const { data, program } = readyWorkingListData()
        const pendingProgram = Promise.withResolvers<typeof program>()
        const screen = await render(
            <WorkingListTestRuntime
                client={workingListTestQueryClient()}
                data={{ ...data, programs: () => pendingProgram.promise }}
            >
                <WorkingListProvider
                    {...controlledProps}
                    onSelectedSavedListChange={vi.fn()}
                    onPaginationChange={vi.fn()}
                >
                    <WorkingListContainer>
                        <span data-testid="composed-child">Child</span>
                    </WorkingListContainer>
                </WorkingListProvider>
            </WorkingListTestRuntime>
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

        pendingProgram.resolve({
            ...program,
            programType: 'WITHOUT_REGISTRATION',
        })
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
