import { Result } from 'better-result'
import React from 'react'
import { render } from 'vitest-browser-react'
import { resolveWorkingListCapabilities } from '../../api/capabilities'
import type {
    WorkingListActions,
    WorkingListMeta,
    WorkingListSavedView,
} from '../../provider/contracts'
import {
    IncompatibleSavedListError,
    InvalidConfigurationError,
    NoSelectedSavedListError,
    OfflineMutationError,
    SavedListNotFoundError,
    SavedListPermissionError,
    WorkingListInvalidResponseError,
    WorkingListNetworkError,
    type UpdateSelectedViewError,
} from '../../provider/errors'
import { createWorkingListProviderStore } from '../../provider/store'
import { WorkingListPublicContext } from '../../provider/WorkingListContext'
import {
    WorkingListPrivateUiContext,
    type WorkingListPrivateUiContextValue,
} from '../../provider/WorkingListPrivateContext'
import { WorkingListToolbarActions } from '../Actions'
import { WorkingListSavedViews } from '../SavedViews/WorkingListSavedViews'
import { WorkingListTextProvider } from '../WorkingListText'

const view: WorkingListSavedView = {
    id: 'SavedList01',
    name: 'Owned view',
    generated: false,
    compatible: true,
    canUpdate: true,
    canDelete: true,
    canShare: false,
}
const readyMeta: WorkingListMeta = {
    lifecycle: { status: 'ready' },
    selection: { status: 'ready', selectedSavedListId: view.id },
    activeConfiguration: { status: 'ready' },
    savedViews: {
        status: 'ready',
        views: [view],
        isUpdating: false,
        usingGeneratedViews: false,
    },
    mutations: {
        create: { status: 'idle' },
        update: { status: 'idle' },
        delete: { status: 'idle' },
    },
    results: { status: 'pending' },
    dirty: true,
    online: true,
    pagination: { page: 1, pageSize: 15 },
    fields: [],
}
const privateUi: WorkingListPrivateUiContextValue = {
    privateActions: {
        retryResults: async () => undefined,
        retrySavedViews: async () => undefined,
        sharingSaved: async () => undefined,
        repairSelectedSavedList: async () => Result.ok(),
    },
    client: {
        query: async () => {
            throw new Error('UI copy test must not query')
        },
        mutate: async () => {
            throw new Error('UI copy test must not mutate')
        },
    },
    programId: 'Program0001',
    orgUnitId: 'OrgUnit0001',
    locale: 'en',
    translate: (message) => message,
    capabilities: resolveWorkingListCapabilities({ apiVersion: 43 }),
    displayedLists: [],
    mutationBusy: false,
    resultTargets: new Map(),
}
const renderSurfaces = async (error: UpdateSelectedViewError) => {
    const store = createWorkingListProviderStore(readyMeta)
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
        createView: async () => Result.ok({ viewId: 'new' }),
        updateSelectedView: async () => Result.err(error),
        deleteView: async () => Result.ok(),
        downloadVisibleRows: () => Result.ok(),
    }
    const screen = await render(
        <WorkingListTextProvider translate={(message) => message}>
            <WorkingListPublicContext.Provider value={{ store, actions }}>
                <WorkingListPrivateUiContext.Provider value={privateUi}>
                    <WorkingListToolbarActions />
                    <WorkingListSavedViews />
                </WorkingListPrivateUiContext.Provider>
            </WorkingListPublicContext.Provider>
        </WorkingListTextProvider>
    )
    return { screen, store }
}
const commonCases = [
    [
        new OfflineMutationError({ message: 'offline' }),
        'This action is unavailable while offline.',
    ],
    [
        new WorkingListNetworkError({ operation: 'test', message: 'network' }),
        'A network error stopped the request. Check the connection and try again.',
    ],
    [
        new WorkingListInvalidResponseError({
            operation: 'test',
            message: 'response',
        }),
        'The server returned an unexpected response.',
    ],
    [
        new SavedListPermissionError({
            savedListId: view.id,
            operation: 'update',
            message: 'permission',
        }),
        'You do not have permission to make this change.',
    ],
    [
        new SavedListNotFoundError({
            savedListId: view.id,
            message: 'missing',
        }),
        'The working list could not be found. It may have been deleted.',
    ],
    [
        new IncompatibleSavedListError({
            savedListId: view.id,
            message: 'incompatible',
        }),
        'Repair this working list before saving changes to it.',
    ],
    [
        new NoSelectedSavedListError({ message: 'none' }),
        'Select a saved working list before updating it.',
    ],
] as const

describe('saved-action surfaces', () => {
    it.each(commonCases)(
        'shows the common %s copy in both action surfaces',
        async (error, copy) => {
            const { screen } = await renderSurfaces(error)
            await screen
                .getByRole('button', { name: 'Save view', exact: true })
                .click()
            await screen
                .getByRole('menuitem', { name: 'Save changes to this view' })
                .click()
            await expect
                .element(screen.getByTestId('working-list-save-error'))
                .toHaveTextContent(copy)
            await screen
                .getByTestId('working-list-view-SavedList01-menu')
                .click()
            await screen
                .getByRole('menuitem', { name: 'Save changes to this view' })
                .click()
            await expect
                .element(screen.getByTestId('working-list-view-action-error'))
                .toHaveTextContent(copy)
            await screen.unmount()
        }
    )
    it('keeps invalid-configuration wording specific to saving versus selecting a view', async () => {
        const { screen } = await renderSurfaces(
            new InvalidConfigurationError({ message: 'invalid' })
        )
        await screen
            .getByRole('button', { name: 'Save view', exact: true })
            .click()
        await screen
            .getByRole('menuitem', { name: 'Save changes to this view' })
            .click()
        await expect
            .element(screen.getByTestId('working-list-save-error'))
            .toHaveTextContent(
                'The current working list configuration cannot be saved.'
            )
        await screen.getByTestId('working-list-view-SavedList01-menu').click()
        await screen
            .getByRole('menuitem', { name: 'Save changes to this view' })
            .click()
        await expect
            .element(screen.getByTestId('working-list-view-action-error'))
            .toHaveTextContent(
                'The selected working list could not be applied.'
            )
        await screen.unmount()
    })
    it('keeps pending and empty-error states distinct from a ready or cached view bar', async () => {
        const error = new WorkingListNetworkError({
            operation: 'test',
            message: 'network',
        })
        const { screen, store } = await renderSurfaces(error)
        const setSavedViews = (savedViews: WorkingListMeta['savedViews']) =>
            store.setState(({ meta }) => ({ meta: { ...meta, savedViews } }))
        setSavedViews({ status: 'pending', views: [] })
        await expect
            .element(
                screen.getByRole('button', { name: 'Owned view', exact: false })
            )
            .not.toBeInTheDocument()
        await expect
            .element(screen.getByTestId('saved-working-lists-error'))
            .not.toBeInTheDocument()
        setSavedViews({ status: 'error', views: [], error })
        await expect
            .element(screen.getByTestId('saved-list-bar'))
            .not.toBeInTheDocument()
        await expect
            .element(screen.getByTestId('saved-working-lists-error'))
            .toBeVisible()
        setSavedViews({ status: 'error', views: [view], error })
        await expect
            .element(
                screen.getByRole('button', { name: 'Owned view', exact: false })
            )
            .toBeVisible()
        expect(
            screen.container.querySelectorAll('[data-testid="saved-list-bar"]')
        ).toHaveLength(1)
        await expect
            .element(screen.getByTestId('saved-working-lists-error'))
            .toBeVisible()
        await screen.unmount()
    })
})
