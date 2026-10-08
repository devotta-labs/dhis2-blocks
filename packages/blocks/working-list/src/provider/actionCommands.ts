import { Result } from 'better-result'
import { fieldsForConfiguration } from '../api/metadata'
import {
    createSavedWorkingList,
    deleteSavedWorkingList,
    replaceSavedWorkingList,
} from '../api/savedLists'
import { DEFAULT_WORKING_LIST_SORT } from '../query/serialize'
import {
    internalConfigurationFingerprint,
    isCurrentSelection,
} from './configuration'
import type {
    AppliedFilter,
    WorkingListActionImplementation,
    WorkingListMutationStatus,
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
import type { CreateWorkingListActionsOptions } from './actionRuntime'

const idleMutation = (): WorkingListMutationStatus => ({ status: 'idle' })

export const createWorkingListActions = ({
    runtimeRef,
    capabilities,
    client,
    defaultListId,
    selectSavedList,
    refreshSavedLists,
    setMutation,
    stagePagination,
    translate,
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

        const fields = fieldsForConfiguration(
            runtime.metadata,
            runtime.activeState.configuration
        )

        if (!fields.has(fieldId)) {
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

        const filters = current.filters.filter((filter) => {
            const field = runtime.metadata?.fields.get(filter.fieldId)

            return (
                field?.scope === 'trackedEntity' &&
                (!programStageId || field.id !== 'assignedUser')
            )
        })

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
    selectView(id) {
        if (!id.trim())
            return Result.err(
                new InvalidConfigurationError({
                    message: 'A saved-list id is required',
                })
            )
        selectSavedList(id)

        return Result.ok()
    },
    clearViewSelection() {
        selectSavedList(defaultListId)

        return Result.ok()
    },
    async createView(name) {
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
        const requestedId = runtime.requestedId

        try {
            const snapshot = runtime.resolvedConfiguration
            const fields = fieldsForConfiguration(runtime.metadata, snapshot)

            const id = await createSavedWorkingList({
                client,
                name: trimmed,
                configuration: snapshot,
                fields,
                capabilities,
                serializationContext: runtime.serializationContext,
            })

            const lists = await refreshSavedLists()
            const confirmed = lists.find((list) => list.id === id)

            if (!confirmed || confirmed.compatibility !== 'compatible') {
                return Result.err(
                    new WorkingListInvalidResponseError({
                        operation: 'createView',
                        message: `Created saved list ${id} was absent from canonical refresh`,
                    })
                )
            }

            if (
                isCurrentSelection(runtimeRef.current.requestedId, requestedId)
            ) {
                selectSavedList(id)
            }

            return Result.ok({ viewId: id })
        } catch (cause) {
            return Result.err(
                toTransportError(cause, 'Creating a saved working list')
            )
        } finally {
            setMutation('create', idleMutation())
        }
    },
    async updateSelectedView() {
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
            const fields = fieldsForConfiguration(runtime.metadata, snapshot)
            await replaceSavedWorkingList({
                client,
                id,
                resource: list.resource,
                existingResource: list.raw,
                name: list.name,
                configuration: snapshot,
                fields,
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
                        operation: 'updateSelectedView',
                        message: `Updated saved list ${id} did not match the submitted configuration after canonical refresh`,
                    })
                )
            }

            return Result.ok()
        } catch (cause) {
            return Result.err(
                toTransportError(cause, 'Updating the saved working list')
            )
        } finally {
            setMutation('update', idleMutation())
        }
    },
    async deleteView(id) {
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
                        operation: 'deleteView',
                        message: `Deleted saved list ${id} remained after canonical refresh`,
                    })
                )
            }

            if (isCurrentSelection(runtimeRef.current.requestedId, id)) {
                selectSavedList(defaultListId)
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
            !runtime.resolvedConfiguration ||
            !runtime.metadata ||
            !runtime.formattingContext ||
            !runtime.program ||
            runtime.results.status !== 'ready'
        ) {
            return Result.err(
                new DownloadVisibleRowsError({
                    message: 'Working-list results are not ready to download',
                })
            )
        }

        try {
            const fields = fieldsForConfiguration(
                runtime.metadata,
                runtime.resolvedConfiguration
            )

            downloadRowsAsCsv({
                rows: runtime.rows,
                columns: runtime.activeState.configuration.columns,
                fields,
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
