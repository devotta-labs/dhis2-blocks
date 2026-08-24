/* oxlint-disable anti-slop/no-module-mocking -- The view-switcher boundary is isolated from saved-view data behavior already covered separately. */
import { Result } from 'better-result'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
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

jest.mock('../SavedViews', () => ({
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
    selectSavedList: () => Result.ok(),
    clearSavedListSelection: () => Result.ok(),
    createSavedList: async () => Result.ok({ savedListId: 'new-view' }),
    updateSelectedSavedList: async () => Result.ok(),
    deleteSavedList: async () => Result.ok(),
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

const withActEnvironment = (run: () => void) => {
    const original = globalThis.IS_REACT_ACT_ENVIRONMENT
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    try {
        run()
    } finally {
        globalThis.IS_REACT_ACT_ENVIRONMENT = original
    }
}

describe('WorkingList structural components', () => {
    it('provides localized accessible defaults and forwards native props', () => {
        withActEnvironment(() => {
            const container = document.createElement('div')
            const root = createRoot(container)
            const store = createWorkingListProviderStore(
                meta({ status: 'pending' })
            )

            try {
                act(() => {
                    root.render(
                        <WorkingListTextProvider
                            translate={(message) => message}
                        >
                            <WorkingListPublicContext.Provider
                                value={{ store, actions }}
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
                            </WorkingListPublicContext.Provider>
                        </WorkingListTextProvider>
                    )
                })

                const viewSwitcher = container.querySelector<HTMLElement>(
                    '[data-testid="working-list-view-switcher"]'
                )
                const heading = viewSwitcher?.querySelector('h2')
                expect(heading?.textContent).toBe('Saved views in this program')
                expect(viewSwitcher?.getAttribute('aria-labelledby')).toBe(
                    heading?.id
                )
                expect(viewSwitcher?.className).toBe('views-class')
                expect(viewSwitcher?.dataset.consumer).toBe('views')

                const toolbar = container.querySelector<HTMLElement>(
                    '[data-testid="working-list-toolbar"]'
                )
                expect(toolbar?.getAttribute('role')).toBe('toolbar')
                expect(toolbar?.getAttribute('aria-label')).toBe(
                    'Working list controls'
                )
                expect(toolbar?.className).toContain('toolbar-class')
                expect(toolbar?.dataset.consumer).toBe('toolbar')

                const table = container.querySelector<HTMLElement>(
                    '[data-testid="working-list-table-section"]'
                )
                expect(table?.tagName).toBe('SECTION')
                expect(table?.getAttribute('aria-label')).toBe(
                    'Working list results'
                )
                expect(table?.className).toBe('table-class')
                expect(table?.dataset.consumer).toBe('table')
            } finally {
                act(() => root.unmount())
            }
        })
    })

    it('keeps lifecycle loading and fatal errors at the outer container', () => {
        withActEnvironment(() => {
            const container = document.createElement('div')
            const root = createRoot(container)
            const store = createWorkingListProviderStore(
                meta({ status: 'pending' })
            )

            try {
                act(() => {
                    root.render(
                        <WorkingListTextProvider
                            translate={(message) => message}
                        >
                            <WorkingListPublicContext.Provider
                                value={{ store, actions }}
                            >
                                <WorkingListContainer>
                                    <span data-testid="composed-child">
                                        Child
                                    </span>
                                </WorkingListContainer>
                            </WorkingListPublicContext.Provider>
                        </WorkingListTextProvider>
                    )
                })

                expect(
                    container.querySelector(
                        '[data-testid="working-list-initializing"]'
                    )
                ).not.toBeNull()
                expect(
                    container
                        .querySelector('[data-testid="working-list"]')
                        ?.hasAttribute('hidden')
                ).toBe(true)
                expect(
                    container.querySelector('[data-testid="composed-child"]')
                ).not.toBeNull()

                act(() =>
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
                )
                expect(
                    container.querySelector(
                        '[data-testid="working-list-lifecycle-error"]'
                    )
                ).not.toBeNull()
            } finally {
                act(() => root.unmount())
            }
        })
    })
})
