import { Result } from 'better-result'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import type {
    WorkingListActions as WorkingListActionsContract,
    WorkingListMeta,
} from '../../provider/contracts'
import { WorkingListPublicContext } from '../../provider/WorkingListContext'
import { createWorkingListProviderStore } from '../../provider/store'
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
    it('keeps familiar configuration controls visible and disabled', () => {
        const actEnvironment = globalThis
        const originalActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = true
        const container = document.createElement('div')
        document.body.appendChild(container)
        const root = createRoot(container)
        const store = createWorkingListProviderStore(unavailableMeta)

        try {
            act(() => {
                root.render(
                    <WorkingListTextProvider translate={(message) => message}>
                        <WorkingListPublicContext.Provider
                            value={{ store, actions }}
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
            })

            const buttons = [...container.querySelectorAll('button')]
            expect(buttons).toHaveLength(4)
            expect(buttons.map((button) => button.textContent?.trim())).toEqual(
                ['Columns', 'Filter', 'Save view', 'More']
            )
            buttons.forEach((button) => expect(button.disabled).toBe(true))
            expect(buttons[2]?.className).toContain('secondary')
            const toolbar = container.querySelector<HTMLElement>(
                '[data-testid="working-list-toolbar"]'
            )
            expect(toolbar?.tagName).toBe('DIV')
            expect(toolbar?.getAttribute('aria-label')).toBe(
                'Working list controls'
            )
            expect(toolbar?.getAttribute('role')).toBe('toolbar')
            expect(toolbar?.hasAttribute('aria-labelledby')).toBe(false)
            expect(
                container.querySelector('[data-consumer="columns"]')?.className
            ).toBe('consumer-columns')
            const filterControls = container.querySelector(
                '[data-consumer="filters"]'
            )
            expect(filterControls?.className).toContain('consumer-filters')
            expect(filterControls?.className).toContain('gap-1')
            expect(filterControls?.className).not.toContain('gap-2')
            expect(
                container.querySelector('[data-consumer="actions"]')?.className
            ).toContain('consumer-actions')
            expect(container.textContent).not.toContain(
                'Tracked entity filters'
            )
        } finally {
            act(() => root.unmount())
            container.remove()
            actEnvironment.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment
        }
    })
})
