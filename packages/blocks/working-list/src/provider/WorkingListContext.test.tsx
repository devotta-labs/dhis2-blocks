import { Result } from 'better-result'
import { renderHook } from 'vitest-browser-react'
import type { WorkingListActions } from './contracts'
import { useStableWorkingListActions } from './WorkingListContext'

const createActions = (): WorkingListActions => ({
    setFilter: vi.fn(() => Result.ok()),
    removeFilter: vi.fn(() => Result.ok()),
    setColumns: vi.fn(() => Result.ok()),
    setSort: vi.fn(() => Result.ok()),
    setProgramStage: vi.fn(() => Result.ok()),
    setPage: vi.fn(() => Result.ok()),
    setPageSize: vi.fn(() => Result.ok()),
    selectView: vi.fn(() => Result.ok()),
    clearViewSelection: vi.fn(() => Result.ok()),
    createView: vi.fn(async () => Result.ok({ viewId: 'SavedList01' })),
    updateSelectedView: vi.fn(async () => Result.ok()),
    deleteView: vi.fn(async () => Result.ok()),
    downloadVisibleRows: vi.fn(() => Result.ok()),
})

describe('useStableWorkingListActions', () => {
    it('keeps the public object and dispatchers stable while using current handlers', async () => {
        const firstHandlers = createActions()
        const secondHandlers = createActions()
        const { result, rerender, act } = await renderHook(
            (props?: { current: WorkingListActions }) =>
                useStableWorkingListActions(props?.current ?? firstHandlers),
            { initialProps: { current: firstHandlers } }
        )
        const first = result.current
        await rerender({ current: secondHandlers })
        const second = result.current

        expect(first).toBe(second)
        expect(first.setPage).toBe(second.setPage)
        second.setPage(3)
        expect(firstHandlers.setPage).not.toHaveBeenCalled()
        expect(secondHandlers.setPage).toHaveBeenCalledWith(3)

        second.selectView('View00000001')
        expect(secondHandlers.selectView).toHaveBeenCalledWith('View00000001')

        let createdViewId: string | undefined
        await act(async () => {
            const createResult = await second.createView('New view')
            if (Result.isOk(createResult)) {
                createdViewId = createResult.value.viewId
            }
        })
        expect(secondHandlers.createView).toHaveBeenCalledWith('New view')
        expect(createdViewId).toBe('SavedList01')
    })
})
