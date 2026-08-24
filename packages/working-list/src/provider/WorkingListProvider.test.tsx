/* oxlint-disable anti-slop/no-module-mocking -- This provider integration test replaces only the two host runtime hook boundaries. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { WorkingListActions, WorkingListSelectionMeta } from './contracts'
import { useWorkingListActions, useWorkingListMeta } from './WorkingListContext'
import { WorkingListProvider } from './WorkingListProvider'

const mockEngine = {
    query: jest.fn(),
    mutate: jest.fn(),
}
const mockPendingQuery = {
    data: undefined,
    error: null,
    isError: false,
    isFetching: false,
    isPending: true,
    isSuccess: false,
    refetch: jest.fn(),
}
const mockUseQuery = jest.fn(() => mockPendingQuery)

jest.mock('@dhis2/app-runtime', () => ({
    useConfig: () => ({ apiVersion: 43 }),
    useDataEngine: () => mockEngine,
    useOnlineStatus: () => ({ online: true }),
}))

jest.mock('@tanstack/react-query', () => ({
    ...jest.requireActual('@tanstack/react-query'),
    useQuery: (...args: unknown[]) => mockUseQuery(...args),
}))

// SAFETY: React reads this documented test-only global flag when deciding whether act() can flush concurrent updates.
const actEnvironment = globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT: boolean
}

describe('WorkingListProvider controlled selection', () => {
    beforeAll(() => {
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = true
    })

    it('hard-transitions immediately and keeps public actions stable across prop changes', () => {
        const container = document.createElement('div')
        const root = createRoot(container)
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        const firstSelectionChange = jest.fn()
        const secondSelectionChange = jest.fn()
        const paginationChange = jest.fn()
        const observedActions: WorkingListActions[] = []
        const observedSelections: WorkingListSelectionMeta[] = []

        const Probe = () => {
            observedActions.push(useWorkingListActions())
            observedSelections.push(
                useWorkingListMeta((meta) => meta.selection)
            )
            return null
        }
        const render = (
            selectedSavedListId: string | null,
            onSelectedSavedListChange: (id: string) => void,
            orgUnitId = 'OrgUnit00001'
        ) => (
            <QueryClientProvider client={queryClient}>
                <WorkingListProvider
                    programId="Program0001"
                    orgUnitId={orgUnitId}
                    selectedSavedListId={selectedSavedListId}
                    onSelectedSavedListChange={onSelectedSavedListChange}
                    pagination={{ page: 3, pageSize: 15 }}
                    onPaginationChange={paginationChange}
                >
                    <Probe />
                </WorkingListProvider>
            </QueryClientProvider>
        )

        act(() => root.render(render('SavedList01', firstSelectionChange)))
        expect(observedSelections.at(-1)).toEqual({
            status: 'pending',
            requestedSavedListId: 'SavedList01',
        })
        expect(paginationChange).toHaveBeenCalledWith({
            page: 1,
            pageSize: 15,
        })
        const initialActions = observedActions.at(-1)

        paginationChange.mockClear()
        act(() =>
            root.render(
                render('SavedList01', firstSelectionChange, 'OrgUnit00002')
            )
        )
        expect(paginationChange).toHaveBeenCalledWith({
            page: 1,
            pageSize: 15,
        })

        act(() => root.render(render('SavedList02', secondSelectionChange)))
        expect(observedSelections.at(-1)).toEqual({
            status: 'pending',
            requestedSavedListId: 'SavedList02',
        })
        expect(observedActions.at(-1)).toBe(initialActions)

        act(() => {
            observedActions.at(-1)?.selectView('SavedList03')
        })
        expect(firstSelectionChange).not.toHaveBeenCalled()
        expect(secondSelectionChange).toHaveBeenCalledWith('SavedList03')
        expect(observedSelections.at(-1)).toEqual({
            status: 'pending',
            requestedSavedListId: 'SavedList03',
        })

        act(() => root.unmount())
        queryClient.clear()
    })

    it.each([
        ['null', null],
        ['an empty string', ''],
    ])('uses the generated default for %s', (_label, selectedSavedListId) => {
        const container = document.createElement('div')
        const root = createRoot(container)
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        const selectionChange = jest.fn()
        const paginationChange = jest.fn()
        const observedSelections: WorkingListSelectionMeta[] = []

        const Probe = () => {
            observedSelections.push(
                useWorkingListMeta((meta) => meta.selection)
            )
            return null
        }

        act(() =>
            root.render(
                <QueryClientProvider client={queryClient}>
                    <WorkingListProvider
                        programId="Program0001"
                        orgUnitId="OrgUnit00001"
                        selectedSavedListId={selectedSavedListId}
                        onSelectedSavedListChange={selectionChange}
                        pagination={{ page: 3, pageSize: 15 }}
                        onPaginationChange={paginationChange}
                    >
                        <Probe />
                    </WorkingListProvider>
                </QueryClientProvider>
            )
        )

        expect(observedSelections.at(-1)).toEqual({
            status: 'pending',
            requestedSavedListId: 'Program0001-default',
        })
        expect(selectionChange).not.toHaveBeenCalled()
        expect(paginationChange).toHaveBeenCalledWith({
            page: 1,
            pageSize: 15,
        })

        act(() => root.unmount())
        queryClient.clear()
    })
})
