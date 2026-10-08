import { Result } from 'better-result'
import React from 'react'
import { render } from 'vitest-browser-react'
import type {
    WorkingListActions as WorkingListActionsContract,
    WorkingListMeta,
} from '../../provider/contracts'
import { WorkingListPublicContext } from '../../provider/WorkingListContext'
import { WorkingListToolbarActions } from '../Actions'
import { WorkingListColumnSelector } from '../Columns'
import { WorkingListFilterControls } from '../Filters'
import { WorkingListToolbar } from '../Toolbar'
import { WorkingListTextProvider } from '../WorkingListText'

const actions: WorkingListActionsContract = {
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

const unavailableMeta: WorkingListMeta = {
    lifecycle: { status: 'ready' },
    selection: {
        status: 'pending',
        requestedSavedListId: 'requested-view',
    },
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
}

describe('working-list unavailable toolbar', () => {
    it('keeps familiar configuration controls visible and disabled', async () => {
        const screen = await render(
            <WorkingListTextProvider translate={(message) => message}>
                <WorkingListPublicContext.Provider
                    value={{ snapshot: { meta: unavailableMeta }, actions }}
                >
                    <WorkingListToolbar>
                        <WorkingListColumnSelector
                            className="consumer-columns"
                            data-consumer="columns"
                        />
                        <WorkingListFilterControls
                            className="consumer-filters"
                            data-consumer="filters"
                        />
                        <WorkingListToolbarActions
                            className="consumer-actions"
                            data-consumer="actions"
                        />
                    </WorkingListToolbar>
                </WorkingListPublicContext.Provider>
            </WorkingListTextProvider>
        )

        const toolbar = screen.getByRole('toolbar', {
            name: 'Working list controls',
        })

        await expect.element(toolbar).toBeVisible()

        for (const name of ['Columns', 'Filter', 'Save view', 'More']) {
            await expect
                .element(screen.getByRole('button', { name }))
                .toBeDisabled()
        }

        expect(
            screen.container.querySelector('[data-consumer="columns"]')
                ?.className
        ).toBe('consumer-columns')

        const filterControls = screen.container.querySelector(
            '[data-consumer="filters"]'
        )

        expect(filterControls?.className).toContain('consumer-filters')
        expect(filterControls?.className).toContain('gap-1')
        expect(filterControls?.className).not.toContain('gap-2')
        expect(
            screen.container.querySelector('[data-consumer="actions"]')
                ?.className
        ).toContain('consumer-actions')
        expect(screen.container.textContent).not.toContain(
            'Tracked entity filters'
        )
    })
})
