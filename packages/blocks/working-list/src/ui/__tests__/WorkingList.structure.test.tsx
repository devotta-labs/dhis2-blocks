/* oxlint-disable anti-slop/no-module-mocking -- The view-switcher boundary is isolated from saved-view data behavior already covered separately. */
import { Result } from 'better-result'
import React from 'react'
import { render } from 'vitest-browser-react'
import type {
    WorkingListActions,
    WorkingListMeta,
} from '../../provider/contracts'
import { WorkingListPublicContext } from '../../provider/WorkingListContext'
import { WorkingListInitializationError } from '../../provider/errors'
import { createWorkingListProviderStore } from '../../provider/store'
import { WorkingListContainer } from '../Container'
import { WorkingListTable } from '../Results'
import { WorkingListToolbar } from '../Toolbar'
import { WorkingListTextProvider } from '../WorkingListText'
import { WorkingListTableSkeleton } from '../WorkingListTable'

vi.mock('../SavedViews', () => ({
    WorkingListSavedViews: () => <div data-testid="saved-views-content" />,
}))

import { WorkingListViewSwitcher } from '../WorkingList'

const actions: WorkingListActions = {
    setFilter: () => Result.ok(),
    removeFilter: () => Result.ok(),
    setColumns: () => Result.ok(),
    setSort: () => Result.ok(),
    setProgramStage: () => Result.ok(),
    setPage: () => Result.ok(),
    setPageSize: () => Result.ok(),
    selectView: () => Result.ok(),
    clearViewSelection: () => Result.ok(),
    createView: async () => Result.ok({ viewId: 'new-view' }),
    updateSelectedView: async () => Result.ok(),
    deleteView: async () => Result.ok(),
    downloadVisibleRows: () => Result.ok(),
}

const meta = (lifecycle: WorkingListMeta['lifecycle']): WorkingListMeta => ({
    lifecycle,
    selection: { status: 'pending' },
    activeConfiguration: { status: 'unavailable' },
    savedViews: { status: 'pending', views: [] },
    mutations: {
        create: { status: 'idle' },
        update: { status: 'idle' },
        delete: { status: 'idle' },
    },
    results: { status: 'pending' },
    dirty: false,
    online: true,
    pagination: { page: 1, pageSize: 15 },
    fields: [],
})

describe('WorkingList structural components', () => {
    it('renders page-sized skeleton rows with disabled shadcn pagination', async () => {
        const screen = await render(
            <WorkingListTextProvider translate={(message) => message}>
                <WorkingListTableSkeleton pageSize={15} />
            </WorkingListTextProvider>
        )

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
        const store = createWorkingListProviderStore(
            meta({ status: 'pending' })
        )
        const screen = await render(
            <WorkingListTextProvider translate={(message) => message}>
                <WorkingListPublicContext.Provider value={{ store, actions }}>
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
                </WorkingListPublicContext.Provider>
            </WorkingListTextProvider>
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
        expect(toolbar?.className).toContain('items-center')
        expect(toolbar?.className).not.toContain('items-start')
        expect(toolbar?.className).toContain('gap-1')
        expect(toolbar?.className).not.toContain('gap-2')
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
        const store = createWorkingListProviderStore(
            meta({ status: 'pending' })
        )
        const screen = await render(
            <WorkingListTextProvider translate={(message) => message}>
                <WorkingListPublicContext.Provider value={{ store, actions }}>
                    <WorkingListContainer>
                        <span data-testid="composed-child">Child</span>
                    </WorkingListContainer>
                </WorkingListPublicContext.Provider>
            </WorkingListTextProvider>
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

        store.setState((current) => ({
            meta: {
                ...current.meta,
                lifecycle: {
                    status: 'error',
                    error: new WorkingListInitializationError({
                        message: 'Failed to initialize',
                    }),
                },
            },
        }))
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
