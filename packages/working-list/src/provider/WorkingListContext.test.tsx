import { Result } from 'better-result'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { WorkingListActions } from './contracts'
import { useStableWorkingListActions } from './WorkingListContext'

// SAFETY: React reads this documented test-only global flag when deciding whether act() can flush concurrent updates.
const actEnvironment = globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT: boolean
}
actEnvironment.IS_REACT_ACT_ENVIRONMENT = true

const createActions = (): WorkingListActions => ({
    setFilter: jest.fn(() => Result.ok()),
    removeFilter: jest.fn(() => Result.ok()),
    setColumns: jest.fn(() => Result.ok()),
    setSort: jest.fn(() => Result.ok()),
    setProgramStage: jest.fn(() => Result.ok()),
    setPage: jest.fn(() => Result.ok()),
    setPageSize: jest.fn(() => Result.ok()),
    selectView: jest.fn(() => Result.ok()),
    clearViewSelection: jest.fn(() => Result.ok()),
    createView: jest.fn(async () => Result.ok({ viewId: 'SavedList01' })),
    updateSelectedView: jest.fn(async () => Result.ok()),
    deleteView: jest.fn(async () => Result.ok()),
    selectSavedList: jest.fn(() => Result.ok()),
    clearSavedListSelection: jest.fn(() => Result.ok()),
    createSavedList: jest.fn(async () =>
        Result.ok({ savedListId: 'SavedList01' })
    ),
    updateSelectedSavedList: jest.fn(async () => Result.ok()),
    deleteSavedList: jest.fn(async () => Result.ok()),
    downloadVisibleRows: jest.fn(() => Result.ok()),
})

describe('useStableWorkingListActions', () => {
    it('keeps the public object and dispatchers stable while using current handlers', async () => {
        const container = document.createElement('div')
        const root = createRoot(container)
        const firstHandlers = createActions()
        const secondHandlers = createActions()
        const observed: WorkingListActions[] = []

        const Probe = ({ current }: { current: WorkingListActions }) => {
            observed.push(useStableWorkingListActions(current))
            return null
        }

        act(() => root.render(<Probe current={firstHandlers} />))
        const first = observed.at(-1)
        act(() => root.render(<Probe current={secondHandlers} />))
        const second = observed.at(-1)

        expect(first).toBe(second)
        expect(first?.setPage).toBe(second?.setPage)
        second?.setPage(3)
        expect(firstHandlers.setPage).not.toHaveBeenCalled()
        expect(secondHandlers.setPage).toHaveBeenCalledWith(3)

        second?.selectView('View00000001')
        expect(secondHandlers.selectSavedList).toHaveBeenCalledWith(
            'View00000001'
        )

        let createdViewId: string | undefined
        await act(async () => {
            const result = await second?.createView('New view')
            if (result && Result.isOk(result)) {
                createdViewId = result.value.viewId
            }
        })
        expect(secondHandlers.createSavedList).toHaveBeenCalledWith('New view')
        expect(createdViewId).toBe('SavedList01')

        act(() => root.unmount())
    })
})
