import React, { act } from 'react'
import { onTestFinished } from 'vitest'
import { render } from 'vitest-browser-react'
import {
    readyWorkingListData,
    WorkingListTestRuntime,
    workingListTestQueryClient,
} from '../test/WorkingListTestRuntime'
import type { WorkingListActions, WorkingListSelectionMeta } from './contracts'
import { useWorkingListActions, useWorkingListMeta } from './WorkingListContext'
import { WorkingListProvider } from './WorkingListProvider'

const pendingProgramData = () => {
    const { data, program } = readyWorkingListData()
    const response = Promise.withResolvers<typeof program>()
    onTestFinished(() => response.resolve(program))
    return { ...data, programs: () => response.promise }
}

describe('WorkingListProvider controlled selection', () => {
    it('hard-transitions immediately and keeps public actions stable across prop changes', async () => {
        const queryClient = workingListTestQueryClient()
        const data = pendingProgramData()
        const firstSelectionChange = vi.fn()
        const secondSelectionChange = vi.fn()
        const paginationChange = vi.fn()
        const observedActions: WorkingListActions[] = []
        const observedSelections: WorkingListSelectionMeta[] = []

        const Probe = () => {
            const actions = useWorkingListActions()
            const selection = useWorkingListMeta((meta) => meta.selection)
            observedActions.push(actions)
            observedSelections.push(selection)
            return null
        }
        const renderProvider = (
            selectedSavedListId: string | null,
            onSelectedSavedListChange: (id: string) => void,
            orgUnitId = 'OrgUnit00001'
        ) => (
            <WorkingListTestRuntime client={queryClient} data={data}>
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
            </WorkingListTestRuntime>
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

        await act(() => {
            observedActions.at(-1)?.selectView('SavedList03')
        })
        expect(firstSelectionChange).not.toHaveBeenCalled()
        expect(secondSelectionChange).toHaveBeenCalledWith('SavedList03')
        expect(observedSelections.at(-1)).toEqual({
            status: 'pending',
            requestedSavedListId: 'SavedList03',
        })
    })

    it.each([
        ['null', null],
        ['an empty string', ''],
    ])(
        'uses the generated default for %s',
        async (_label, selectedSavedListId) => {
            const queryClient = workingListTestQueryClient()
            const data = pendingProgramData()
            const selectionChange = vi.fn()
            const paginationChange = vi.fn()
            const observedSelections: WorkingListSelectionMeta[] = []

            const Probe = () => {
                const selection = useWorkingListMeta((meta) => meta.selection)
                observedSelections.push(selection)
                return null
            }

            await render(
                <WorkingListTestRuntime client={queryClient} data={data}>
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
                </WorkingListTestRuntime>
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
        }
    )
})
