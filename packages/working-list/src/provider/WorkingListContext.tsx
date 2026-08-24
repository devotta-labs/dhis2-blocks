import { Result } from 'better-result'
import React, { createContext, useContext, useMemo, useRef } from 'react'
import { useStore } from 'zustand'
import type {
    WorkingListActions,
    WorkingListActionImplementation,
    WorkingListMeta,
    WorkingListState,
} from './contracts'
import type { WorkingListProviderStore } from './store'

interface WorkingListPublicContextValue {
    store: WorkingListProviderStore
    actions: WorkingListActions
}

export const WorkingListPublicContext =
    createContext<WorkingListPublicContextValue | null>(null)

const usePublicContext = () => {
    const context = useContext(WorkingListPublicContext)
    if (!context) {
        throw new Error(
            'Working List hooks must be used within WorkingList or WorkingList.Provider.'
        )
    }
    return context
}

export const useWorkingListState = <TSelected,>(
    selector: (state: WorkingListState) => TSelected
): TSelected => {
    const { store } = usePublicContext()
    return useStore(store, (snapshot) => {
        if (!snapshot.activeState) {
            throw new Error(
                'useWorkingListState requires a ready active configuration. Select active-configuration readiness through useWorkingListMeta before mounting the stateful consumer.'
            )
        }
        return selector(snapshot.activeState)
    })
}

export const useWorkingListMeta = <TSelected,>(
    selector: (meta: WorkingListMeta) => TSelected
): TSelected => {
    const { store } = usePublicContext()
    return useStore(store, (snapshot) => selector(snapshot.meta))
}

export const useWorkingListActions = (): WorkingListActions =>
    usePublicContext().actions

export const useStableWorkingListActions = (
    current: WorkingListActionImplementation
): WorkingListActions => {
    const currentRef = useRef(current)
    currentRef.current = current
    return useMemo(
        () => ({
            setFilter: (filter) => currentRef.current.setFilter(filter),
            removeFilter: (fieldId) => currentRef.current.removeFilter(fieldId),
            setColumns: (fieldIds) => currentRef.current.setColumns(fieldIds),
            setSort: (sort) => currentRef.current.setSort(sort),
            setProgramStage: (programStageId) =>
                currentRef.current.setProgramStage(programStageId),
            setPage: (page) => currentRef.current.setPage(page),
            setPageSize: (pageSize) => currentRef.current.setPageSize(pageSize),
            selectView: (id) => currentRef.current.selectSavedList(id),
            clearViewSelection: () =>
                currentRef.current.clearSavedListSelection(),
            createView: async (name) => {
                const result = await currentRef.current.createSavedList(name)
                return Result.isError(result)
                    ? result
                    : Result.ok({ viewId: result.value.savedListId })
            },
            updateSelectedView: () =>
                currentRef.current.updateSelectedSavedList(),
            deleteView: (id) => currentRef.current.deleteSavedList(id),
            selectSavedList: (id) => currentRef.current.selectSavedList(id),
            clearSavedListSelection: () =>
                currentRef.current.clearSavedListSelection(),
            createSavedList: (name) => currentRef.current.createSavedList(name),
            updateSelectedSavedList: () =>
                currentRef.current.updateSelectedSavedList(),
            deleteSavedList: (id) => currentRef.current.deleteSavedList(id),
            downloadVisibleRows: () => currentRef.current.downloadVisibleRows(),
        }),
        []
    )
}
