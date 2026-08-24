import { Result } from 'better-result'
import type { WorkingListCapabilities } from '../api/capabilities'
import type { WorkingListClient } from '../api/client'
import type { ProgramFieldCatalog } from '../api/metadata'
import {
    createSavedWorkingList,
    deleteSavedWorkingList,
    replaceSavedWorkingList,
    type NormalizedSavedWorkingList,
} from '../api/savedLists'
import type { TrackerProgram } from '../api/schemas'
import type { WorkingListConfiguration as InternalConfiguration } from '../domain/model'
import { DEFAULT_WORKING_LIST_SORT } from '../query/serialize'
import type {
    CellFormattingContext,
    FilterSerializationContext,
} from '../registry/valueTypes'
import type { WorkingListTranslate } from '../ui/WorkingListText'
import {
    canCommitMutationBaseline,
    internalConfigurationFingerprint,
    isCurrentSelection,
    publicConfigurationFingerprint,
    toPublicConfiguration,
} from './configuration'
import type {
    AppliedFilter,
    WorkingListActionImplementation,
    WorkingListConfiguration,
    WorkingListDisplayRow,
    WorkingListMeta,
    WorkingListMutationStatus,
    WorkingListPagination,
    WorkingListState,
} from './contracts'
import { WORKING_LIST_PAGE_SIZES } from './contracts'
import { toTransportError } from './errorNormalization'
import {
    DownloadVisibleRowsError,
    IncompatibleSavedListError,
    InvalidConfigurationError,
    InvalidPaginationError,
    NoSelectedSavedListError,
    OfflineMutationError,
    SavedListNotFoundError,
    SavedListPermissionError,
    UnknownFieldError,
    UnknownProgramStageError,
    WorkingListInvalidResponseError,
} from './errors'
import { downloadRowsAsCsv } from './results'
import type {
    WorkingListProviderStore,
    WorkingListProviderStoreState,
} from './store'

export interface WorkingListActionRuntime {
    activeState?: WorkingListState
    resolvedConfiguration?: InternalConfiguration
    metadata?: ProgramFieldCatalog
    serializationContext?: FilterSerializationContext
    formattingContext?: CellFormattingContext
    confirmedLists?: NormalizedSavedWorkingList[]
    displayedLists: readonly NormalizedSavedWorkingList[]
    effectivePagination: WorkingListPagination
    online: boolean
    program?: TrackerProgram
    rows: readonly WorkingListDisplayRow[]
}

interface CreateWorkingListActionsOptions {
    runtimeRef: { current: WorkingListActionRuntime }
    selectionToken: { current: number }
    capabilities: WorkingListCapabilities
    client: WorkingListClient
    defaultListId: string
    hardTransition: (id: string, notify: boolean) => void
    refreshSavedLists: () => Promise<NormalizedSavedWorkingList[]>
    setMutation: (
        operation: keyof WorkingListMeta['mutations'],
        status: WorkingListMutationStatus
    ) => void
    stagePagination: (next: WorkingListPagination) => void
    store: WorkingListProviderStore
    translate: WorkingListTranslate
    updateStore: (
        update: (
            current: WorkingListProviderStoreState
        ) => Partial<WorkingListProviderStoreState>
    ) => void
    validateAndCommit: (
        configuration: WorkingListConfiguration,
        resetPage: boolean
    ) => ReturnType<WorkingListActionImplementation['setColumns']>
}

const idleMutation = (): WorkingListMutationStatus => ({ status: 'idle' })

export const createWorkingListActions = ({
    runtimeRef,
    selectionToken,
    capabilities,
    client,
    defaultListId,
    hardTransition,
    refreshSavedLists,
    setMutation,
    stagePagination,
    store,
    translate,
    updateStore,
    validateAndCommit,
}: CreateWorkingListActionsOptions): WorkingListActionImplementation => ({
    setFilter(filter: AppliedFilter) {
        const runtime = runtimeRef.current
        if (!runtime.activeState)
            throw new Error('Working List configuration is unavailable')
        const filters = runtime.activeState.configuration.filters
        return validateAndCommit(
            {
                ...runtime.activeState.configuration,
                filters: filters.some((item) => item.fieldId === filter.fieldId)
                    ? filters.map((item) =>
                          item.fieldId === filter.fieldId ? filter : item
                      )
                    : [...filters, filter],
            },
            true
        )
    },
    removeFilter(fieldId) {
        const runtime = runtimeRef.current
        if (!runtime.activeState || !runtime.metadata)
            throw new Error('Working List configuration is unavailable')
        if (!runtime.metadata.fields.has(fieldId)) {
            return Result.err(
                new UnknownFieldError({
                    fieldId,
                    message: `Unknown working-list field ${fieldId}`,
                })
            )
        }
        if (
            !runtime.activeState.configuration.filters.some(
                (filter) => filter.fieldId === fieldId
            )
        )
            return Result.ok()
        return validateAndCommit(
            {
                ...runtime.activeState.configuration,
                filters: runtime.activeState.configuration.filters.filter(
                    (filter) => filter.fieldId !== fieldId
                ),
            },
            true
        )
    },
    setColumns(fieldIds) {
        const runtime = runtimeRef.current
        if (!runtime.activeState)
            throw new Error('Working List configuration is unavailable')
        return validateAndCommit(
            {
                ...runtime.activeState.configuration,
                columns: [...fieldIds],
            },
            false
        )
    },
    setSort(sort) {
        const runtime = runtimeRef.current
        if (!runtime.activeState)
            throw new Error('Working List configuration is unavailable')
        return validateAndCommit(
            { ...runtime.activeState.configuration, sort },
            true
        )
    },
    setProgramStage(programStageId) {
        const runtime = runtimeRef.current
        if (!runtime.activeState || !runtime.metadata)
            throw new Error('Working List configuration is unavailable')
        if (
            programStageId !== undefined &&
            !runtime.metadata.readableProgramStageIds.has(programStageId)
        ) {
            return Result.err(
                new UnknownProgramStageError({
                    programStageId,
                    message: `Unknown program stage ${programStageId}`,
                })
            )
        }
        const current = runtime.activeState.configuration
        if (
            (current.mode === 'event' ? current.programStageId : undefined) ===
            programStageId
        )
            return Result.ok()
        const filters = current.filters.filter(
            (filter) =>
                runtime.metadata?.fields.get(filter.fieldId)?.scope ===
                'trackedEntity'
        )
        const columns = programStageId
            ? (runtime.metadata.defaultEventColumnsByStage.get(
                  programStageId
              ) ?? runtime.metadata.defaultTrackedEntityColumns)
            : runtime.metadata.defaultTrackedEntityColumns
        const candidate = programStageId
            ? {
                  mode: 'event' as const,
                  programStageId,
                  filters,
                  columns: [...columns],
                  sort: { ...DEFAULT_WORKING_LIST_SORT },
              }
            : {
                  mode: 'trackedEntity' as const,
                  filters,
                  columns: [...columns],
                  sort: { ...DEFAULT_WORKING_LIST_SORT },
              }
        return validateAndCommit(candidate, true)
    },
    setPage(page) {
        if (!Number.isInteger(page) || page < 1) {
            return Result.err(
                new InvalidPaginationError({
                    message: `Page must be a positive integer; received ${String(page)}`,
                })
            )
        }
        stagePagination({
            page,
            pageSize: runtimeRef.current.effectivePagination.pageSize,
        })
        return Result.ok()
    },
    setPageSize(pageSize) {
        if (!WORKING_LIST_PAGE_SIZES.includes(pageSize)) {
            return Result.err(
                new InvalidPaginationError({
                    message: `Unsupported page size ${String(pageSize)}`,
                })
            )
        }
        stagePagination({ page: 1, pageSize })
        return Result.ok()
    },
    selectSavedList(id) {
        if (!id.trim())
            return Result.err(
                new InvalidConfigurationError({
                    message: 'A saved-list id is required',
                })
            )
        hardTransition(id, true)
        return Result.ok()
    },
    clearSavedListSelection() {
        hardTransition(defaultListId, true)
        return Result.ok()
    },
    async createSavedList(name) {
        const runtime = runtimeRef.current
        if (!runtime.online)
            return Result.err(
                new OfflineMutationError({
                    message: 'Working lists cannot be created while offline',
                })
            )
        if (!runtime.resolvedConfiguration || !runtime.metadata)
            throw new Error('Working List configuration is unavailable')
        const trimmed = name.trim()
        if (!trimmed)
            return Result.err(
                new InvalidConfigurationError({
                    message: 'A working-list name is required',
                })
            )
        setMutation('create', { status: 'pending' })
        const selectionVersion = selectionToken.current
        try {
            const snapshot = runtime.resolvedConfiguration
            const id = await createSavedWorkingList({
                client,
                name: trimmed,
                configuration: snapshot,
                fields: runtime.metadata.fields,
                capabilities,
                serializationContext: runtime.serializationContext,
            })
            const lists = await refreshSavedLists()
            const confirmed = lists.find((list) => list.id === id)
            if (!confirmed || confirmed.compatibility !== 'compatible') {
                return Result.err(
                    new WorkingListInvalidResponseError({
                        operation: 'createSavedList',
                        message: `Created saved list ${id} was absent from canonical refresh`,
                    })
                )
            }
            if (selectionToken.current === selectionVersion) {
                hardTransition(id, true)
            }
            return Result.ok({ savedListId: id })
        } catch (cause) {
            return Result.err(
                toTransportError(cause, 'Creating a saved working list')
            )
        } finally {
            setMutation('create', idleMutation())
        }
    },
    async updateSelectedSavedList() {
        const runtime = runtimeRef.current
        if (!runtime.online)
            return Result.err(
                new OfflineMutationError({
                    message: 'Working lists cannot be updated while offline',
                })
            )
        const id = runtime.activeState?.selectedSavedListId
        if (!id || !runtime.resolvedConfiguration || !runtime.metadata)
            return Result.err(
                new NoSelectedSavedListError({
                    message: 'No persisted saved working list is selected',
                })
            )
        if (
            id === defaultListId ||
            runtime.displayedLists.some(
                (candidate) =>
                    candidate.id === id &&
                    !runtime.confirmedLists?.some(
                        (confirmed) => confirmed.id === id
                    )
            )
        ) {
            return Result.err(
                new NoSelectedSavedListError({
                    message: 'The generated working list cannot be updated',
                })
            )
        }
        const list = runtime.confirmedLists?.find(
            (candidate) => candidate.id === id
        )
        if (!list)
            return Result.err(
                new SavedListNotFoundError({
                    savedListId: id,
                    message: `Saved working list ${id} was not found`,
                })
            )
        if (list.compatibility !== 'compatible')
            return Result.err(
                new IncompatibleSavedListError({
                    savedListId: id,
                    message:
                        'Repair this saved working list before updating it',
                })
            )
        if (
            list.sharing.access?.write !== true ||
            list.sharing.access.update !== true
        )
            return Result.err(
                new SavedListPermissionError({
                    savedListId: id,
                    operation: 'update',
                    message: `Update access to ${id} is required`,
                })
            )
        const expectedResource =
            runtime.resolvedConfiguration.mode === 'event'
                ? 'programStageWorkingLists'
                : 'trackedEntityInstanceFilters'
        if (list.resource !== expectedResource)
            return Result.err(
                new InvalidConfigurationError({
                    message: 'Save this mode change as a new working list',
                })
            )
        setMutation('update', { status: 'pending', targetId: id })
        try {
            const snapshot = runtime.resolvedConfiguration
            await replaceSavedWorkingList({
                client,
                id,
                resource: list.resource,
                existingResource: list.raw,
                name: list.name,
                configuration: snapshot,
                fields: runtime.metadata.fields,
                capabilities,
                sharing: list.sharing,
                serializationContext: runtime.serializationContext,
            })
            const lists = await refreshSavedLists()
            const confirmed = lists.find((candidate) => candidate.id === id)
            if (
                !confirmed ||
                confirmed.compatibility !== 'compatible' ||
                internalConfigurationFingerprint(confirmed.configuration) !==
                    internalConfigurationFingerprint(snapshot)
            ) {
                return Result.err(
                    new WorkingListInvalidResponseError({
                        operation: 'updateSelectedSavedList',
                        message: `Updated saved list ${id} did not match the submitted configuration after canonical refresh`,
                    })
                )
            }
            const publicSnapshot = toPublicConfiguration(snapshot)
            updateStore((current) => {
                if (
                    !canCommitMutationBaseline({
                        currentSelectedId:
                            current.activeState?.selectedSavedListId,
                        currentConfiguration:
                            current.activeState?.configuration,
                        submittedSelectedId: id,
                        submittedConfiguration: publicSnapshot,
                    })
                ) {
                    return {}
                }
                return {
                    baselineFingerprint:
                        publicConfigurationFingerprint(publicSnapshot),
                    meta: { ...current.meta, dirty: false },
                }
            })
            return Result.ok()
        } catch (cause) {
            return Result.err(
                toTransportError(cause, 'Updating the saved working list')
            )
        } finally {
            setMutation('update', idleMutation())
        }
    },
    async deleteSavedList(id) {
        const runtime = runtimeRef.current
        if (!runtime.online)
            return Result.err(
                new OfflineMutationError({
                    message: 'Working lists cannot be deleted while offline',
                })
            )
        const list = runtime.confirmedLists?.find(
            (candidate) => candidate.id === id
        )
        if (!list)
            return Result.err(
                new SavedListNotFoundError({
                    savedListId: id,
                    message: `Saved working list ${id} was not found`,
                })
            )
        if (list.sharing.access?.delete !== true)
            return Result.err(
                new SavedListPermissionError({
                    savedListId: id,
                    operation: 'delete',
                    message: `Delete access to ${id} is required`,
                })
            )
        setMutation('delete', { status: 'pending', targetId: id })
        try {
            await deleteSavedWorkingList(client, list.resource, id)
            const lists = await refreshSavedLists()
            if (lists.some((candidate) => candidate.id === id)) {
                return Result.err(
                    new WorkingListInvalidResponseError({
                        operation: 'deleteSavedList',
                        message: `Deleted saved list ${id} remained after canonical refresh`,
                    })
                )
            }
            if (
                isCurrentSelection(
                    store.getState().activeState?.selectedSavedListId,
                    id
                )
            ) {
                hardTransition(defaultListId, true)
            }
            return Result.ok()
        } catch (cause) {
            return Result.err(
                toTransportError(cause, 'Deleting the saved working list')
            )
        } finally {
            setMutation('delete', idleMutation())
        }
    },
    downloadVisibleRows(): Result<void, DownloadVisibleRowsError> {
        const runtime = runtimeRef.current
        if (
            !runtime.activeState ||
            !runtime.metadata ||
            !runtime.formattingContext ||
            !runtime.program ||
            store.getState().meta.results.status !== 'ready'
        ) {
            return Result.err(
                new DownloadVisibleRowsError({
                    message: 'Working-list results are not ready to download',
                })
            )
        }
        try {
            downloadRowsAsCsv({
                rows: runtime.rows,
                columns: runtime.activeState.configuration.columns,
                fields: runtime.metadata.fields,
                formattingContext: runtime.formattingContext,
                translate,
                fileName: `${runtime.program.displayName}-working-list.csv`,
            })
            return Result.ok()
        } catch (cause) {
            return Result.err(
                new DownloadVisibleRowsError({
                    message: 'Working-list rows could not be downloaded',
                    cause,
                })
            )
        }
    },
})
