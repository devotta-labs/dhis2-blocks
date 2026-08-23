import type { Dispatch, SetStateAction } from 'react'
import type { ProgramFieldCatalog } from '../../../api/metadata'
import type { TrackerProgram } from '../../../api/schemas'
import type {
    AppliedFilter,
    WorkingListCriteria,
    WorkingListViewConfiguration,
} from '../../../domain/model'
import { DEFAULT_WORKING_LIST_SORT } from '../../../query/serialize'
import {
    composeWorkingListConfiguration,
    type WorkingListStore,
} from '../../../store/workingListStore'
import { workingListTableFields } from '../workingListModel'

interface WorkingListEditingOptions {
    store: WorkingListStore
    criteria: WorkingListCriteria
    view: WorkingListViewConfiguration
    setView: Dispatch<SetStateAction<WorkingListViewConfiguration>>
    metadata: ProgramFieldCatalog
    program: TrackerProgram
    pageSize: number
    onPageChange: (page: number, pageSize: number) => void
}

export const useWorkingListEditing = ({
    store,
    criteria,
    view,
    setView,
    metadata,
    program,
    pageSize,
    onPageChange,
}: WorkingListEditingOptions) => {
    const configuration = composeWorkingListConfiguration(criteria, view)
    const updateView = (next: WorkingListViewConfiguration) => {
        setView(next)
        store.getState().reconcileView(next)
    }
    const setFilters = (filters: AppliedFilter[]) => {
        store.getState().setFilters(filters)
        store.getState().reconcileView(view)
        onPageChange(1, pageSize)
    }
    const applyFilter = (filter: AppliedFilter) =>
        setFilters([
            ...criteria.filters.filter(
                (item) => item.field.id !== filter.field.id
            ),
            filter,
        ])
    const resetFilter = (fieldId: string) =>
        setFilters(
            criteria.filters.filter((filter) => filter.field.id !== fieldId)
        )
    const enterStage = (stageId?: string) => {
        if (!stageId) {
            store.getState().leaveEventMode()
            updateView({
                columns: metadata.defaultTrackedEntityColumns,
                sort: { ...DEFAULT_WORKING_LIST_SORT },
            })
            onPageChange(1, pageSize)
            return
        }
        if (criteria.mode === 'event' && criteria.programStageId === stageId) {
            return
        }
        store.getState().enterEventMode(stageId)
        updateView({
            columns:
                metadata.defaultEventColumnsByStage.get(stageId) ??
                metadata.defaultTrackedEntityColumns,
            sort: { ...DEFAULT_WORKING_LIST_SORT },
        })
        onPageChange(1, pageSize)
    }

    return {
        configuration,
        tableFields: workingListTableFields(
            fieldsFrom(metadata),
            program,
            configuration
        ),
        updateView,
        applyFilter,
        resetFilter,
        enterStage,
    }
}

const fieldsFrom = (metadata: ProgramFieldCatalog) => [
    ...metadata.fields.values(),
]
