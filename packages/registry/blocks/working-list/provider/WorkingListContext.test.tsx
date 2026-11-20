import { Result } from 'better-result'
import React, { act } from 'react'
import { render } from 'vitest-browser-react'
import {
    readyWorkingListData,
    WorkingListTestRuntime,
    workingListTestQueryClient,
    WORKING_LIST_PROGRAM,
} from '../test/WorkingListTestRuntime'
import type { WorkingListActions, WorkingListPagination } from './contracts'
import { useWorkingListActions, useWorkingListMeta } from './WorkingListContext'
import { WorkingListProvider } from './WorkingListProvider'

describe('useStableWorkingListActions', () => {
    it('keeps the public object and dispatchers stable while using current handlers', async () => {
        const { data, created } = readyWorkingListData()
        const client = workingListTestQueryClient()
        const firstPageChange =
            vi.fn<(pagination: WorkingListPagination) => void>()
        const secondPageChange =
            vi.fn<(pagination: WorkingListPagination) => void>()
        const firstSelectionChange = vi.fn<(id: string) => void>()
        const secondSelectionChange = vi.fn<(id: string) => void>()
        const observedActions: WorkingListActions[] = []

        const Probe = () => {
            const actions = useWorkingListActions()
            observedActions.push(actions)
            const status = useWorkingListMeta(
                (meta) => meta.activeConfiguration.status
            )
            return <output>{status}</output>
        }
        const tree = (
            onPaginationChange: (pagination: WorkingListPagination) => void,
            onSelectedSavedListChange: (id: string) => void
        ) => (
            <WorkingListTestRuntime client={client} data={data}>
                <WorkingListProvider
                    programId={WORKING_LIST_PROGRAM}
                    orgUnitId="OrgUnit00001"
                    selectedSavedListId={null}
                    onSelectedSavedListChange={onSelectedSavedListChange}
                    pagination={{ page: 1, pageSize: 15 }}
                    onPaginationChange={onPaginationChange}
                >
                    <Probe />
                </WorkingListProvider>
            </WorkingListTestRuntime>
        )

        const screen = await render(tree(firstPageChange, firstSelectionChange))
        await expect
            .element(screen.getByRole('status'))
            .toHaveTextContent('ready')
        const first = observedActions.at(-1)
        expect(first).toBeDefined()
        firstPageChange.mockClear()

        await screen.rerender(tree(secondPageChange, secondSelectionChange))
        const second = observedActions.at(-1)
        if (!second || !first)
            throw new Error('Working List did not expose actions')
        expect(first).toBe(second)
        expect(first.setPage).toBe(second.setPage)

        await act(() => {
            second.setPage(3)
        })
        expect(firstPageChange).not.toHaveBeenCalled()
        expect(secondPageChange).toHaveBeenCalledWith({ page: 3, pageSize: 15 })

        await act(async () => {
            const result = await second.createView('New view')
            expect(
                Result.isOk(result) ? result.value.viewId : result.error
            ).toBe('SavedList01')
        })
        expect(created).toEqual([
            expect.objectContaining({ displayName: 'New view' }),
        ])

        await act(() => {
            second.selectView('View00000001')
        })
        expect(firstSelectionChange).not.toHaveBeenCalled()
        expect(secondSelectionChange).toHaveBeenCalledWith('View00000001')
    })
})
