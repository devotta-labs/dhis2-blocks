/* oxlint-disable anti-slop/no-module-mocking -- This provider integration test replaces only the two host runtime hook boundaries. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { render } from 'vitest-browser-react'
import type { WorkingListActions, WorkingListSelectionMeta } from './contracts'
import { useWorkingListActions, useWorkingListMeta } from './WorkingListContext'
import { WorkingListProvider } from './WorkingListProvider'

const { mockEngine, mockUseQuery } = vi.hoisted(() => {
    const pendingQuery = {
        data: undefined,
        error: null,
        isError: false,
        isFetching: false,
        isPending: true,
        isSuccess: false,
        refetch: vi.fn(),
    }

    return {
        mockEngine: {
            query: vi.fn(),
            mutate: vi.fn(),
        },
        mockUseQuery: vi.fn((..._args: unknown[]) => pendingQuery),
    }
})

vi.mock('@dhis2/app-runtime', () => ({
    useConfig: () => ({ apiVersion: 43 }),
    useDataEngine: () => mockEngine,
    useOnlineStatus: () => ({ online: true }),
}))

vi.mock('@tanstack/react-query', async (importOriginal) => ({
    ...(await importOriginal()),
    useQuery: (...args: unknown[]) => mockUseQuery(...args),
}))

describe('WorkingListProvider controlled selection', () => {
    it('hard-transitions immediately and keeps public actions stable across prop changes', async () => {
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })

        const firstSelectionChange = vi.fn()
        const secondSelectionChange = vi.fn()
        const paginationChange = vi.fn()
        const observedActions: WorkingListActions[] = []
        const observedSelections: WorkingListSelectionMeta[] = []

        const Probe = () => {
            observedActions.push(useWorkingListActions())
            observedSelections.push(
                useWorkingListMeta((meta) => meta.selection)
            )

            return null
        }

        const renderProvider = (
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

        const screen = await render(
            renderProvider('SavedList01', firstSelectionChange)
        )

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
        await screen.rerender(
            renderProvider('SavedList01', firstSelectionChange, 'OrgUnit00002')
        )
        expect(paginationChange).toHaveBeenCalledWith({
            page: 1,
            pageSize: 15,
        })

        await screen.rerender(
            renderProvider('SavedList02', secondSelectionChange)
        )
        expect(observedSelections.at(-1)).toEqual({
            status: 'pending',
            requestedSavedListId: 'SavedList02',
        })
        expect(observedActions.at(-1)).toBe(initialActions)

        observedActions.at(-1)?.selectView('SavedList03')
        expect(firstSelectionChange).not.toHaveBeenCalled()
        expect(secondSelectionChange).toHaveBeenCalledWith('SavedList03')
        await vi.waitFor(() => {
            expect(observedSelections.at(-1)).toEqual({
                status: 'pending',
                requestedSavedListId: 'SavedList03',
            })
        })

        queryClient.clear()
    })

    it.each([
        ['null', null],
        ['an empty string', ''],
    ])(
        'uses the generated default for %s',
        async (_label, selectedSavedListId) => {
            const queryClient = new QueryClient({
                defaultOptions: { queries: { retry: false } },
            })

            const selectionChange = vi.fn()
            const paginationChange = vi.fn()
            const observedSelections: WorkingListSelectionMeta[] = []

            const Probe = () => {
                observedSelections.push(
                    useWorkingListMeta((meta) => meta.selection)
                )

                return null
            }

            await render(
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

            expect(observedSelections.at(-1)).toEqual({
                status: 'pending',
                requestedSavedListId: 'Program0001-default',
            })
            expect(selectionChange).not.toHaveBeenCalled()
            expect(paginationChange).toHaveBeenCalledWith({
                page: 1,
                pageSize: 15,
            })

            queryClient.clear()
        }
    )
})
