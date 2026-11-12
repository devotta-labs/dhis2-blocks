import { useDataEngine, useOnlineStatus } from '@dhis2/app-runtime'
import {
    useIsMutating,
    useMutation,
    useQueryClient,
} from '@tanstack/react-query'
import { fieldsForConfiguration } from '../api/metadata'
import {
    createSavedWorkingList,
    deleteSavedWorkingList,
    replaceSavedWorkingList,
    type NormalizedSavedWorkingList,
    type SavedListResource,
} from '../api/savedLists'
import type { WorkingListConfiguration as InternalConfiguration } from '../domain/model'
import { workingListQueryKeys } from '../query/keys'
import { toTransportError } from './errorNormalization'
import {
    IncompatibleSavedListError,
    InvalidConfigurationError,
    NoSelectedSavedListError,
    OfflineMutationError,
    SavedListNotFoundError,
    SavedListPermissionError,
    type CreateViewError,
    type DeleteViewError,
    type RepairSavedListError,
    type UpdateSelectedViewError,
} from './errors'
import {
    canUpdateSavedList,
    useSavedLists,
    useWorkingListMetadata,
    useWorkingListView,
} from './queries'
import { useWorkingList } from './WorkingListContext'

/** DHIS2 keeps tracked-entity lists and event lists as two resources. */
const savedListResourceFor = (
    configuration: InternalConfiguration
): SavedListResource =>
    configuration.mode === 'event'
        ? 'programStageWorkingLists'
        : 'trackedEntityInstanceFilters'

/** Whether `configuration` can be written over `list` where it is stored. */
export const savesToSameResource = (
    list: NormalizedSavedWorkingList,
    configuration: InternalConfiguration
) => list.resource === savedListResourceFor(configuration)

/**
 * A write changes what the saved lists hold, so each one ends by reloading
 * them. The reload is awaited: the mutation stays pending, and the controls
 * locked, until the list on screen is the server's copy.
 */
const useReloadSavedLists = () => {
    const queryClient = useQueryClient()
    const { programId } = useWorkingList()
    return () =>
        queryClient.invalidateQueries({
            queryKey: workingListQueryKeys.savedLists(programId),
        })
}

/** Saves the configuration on screen as a new list, and selects it. */
export const useCreateSavedList = () => {
    const engine = useDataEngine()
    const reloadSavedLists = useReloadSavedLists()
    const { programId, selectView } = useWorkingList()
    const { online } = useOnlineStatus()
    const { data: metadata } = useWorkingListMetadata()
    const { data: view } = useWorkingListView()

    return useMutation<string, CreateViewError, string>({
        mutationKey: workingListQueryKeys.savedListMutations(programId),
        mutationFn: async (name) => {
            if (!online) {
                throw new OfflineMutationError({
                    message: 'Working lists cannot be created while offline',
                })
            }
            if (!view || !metadata) {
                throw new InvalidConfigurationError({
                    message: 'The working list is not ready to be saved',
                })
            }
            const trimmed = name.trim()
            if (!trimmed) {
                throw new InvalidConfigurationError({
                    message: 'A working-list name is required',
                })
            }
            try {
                return await createSavedWorkingList({
                    engine,
                    name: trimmed,
                    configuration: view.resolvedConfiguration,
                    fields: fieldsForConfiguration(
                        metadata.fieldCatalog,
                        view.resolvedConfiguration
                    ),
                    capabilities: metadata.capabilities,
                    serializationContext: metadata.serializationContext,
                })
            } catch (cause) {
                throw toTransportError(cause, 'Creating a saved working list')
            }
        },
        onSuccess: async (viewId) => {
            await reloadSavedLists()
            selectView(viewId)
        },
    })
}

/**
 * Writes the configuration on screen over the selected saved list. The draft
 * ends by itself once the reloaded list says the same.
 */
export const useUpdateSavedList = () => {
    const engine = useDataEngine()
    const reloadSavedLists = useReloadSavedLists()
    const { programId } = useWorkingList()
    const { online } = useOnlineStatus()
    const { data: metadata } = useWorkingListMetadata()
    const { data: view } = useWorkingListView()

    return useMutation<void, UpdateSelectedViewError, void>({
        mutationKey: workingListQueryKeys.savedListMutations(programId),
        mutationFn: async () => {
            if (!online) {
                throw new OfflineMutationError({
                    message: 'Working lists cannot be updated while offline',
                })
            }
            if (!view || !metadata || view.isGenerated) {
                throw new NoSelectedSavedListError({
                    message: 'No persisted saved working list is selected',
                })
            }
            const { list, resolvedConfiguration } = view
            if (!canUpdateSavedList(list)) {
                throw new SavedListPermissionError({
                    savedListId: list.id,
                    operation: 'update',
                    message: `Update access to ${list.id} is required`,
                })
            }
            if (!savesToSameResource(list, resolvedConfiguration)) {
                throw new InvalidConfigurationError({
                    message: 'Save this mode change as a new working list',
                })
            }
            try {
                await replaceSavedWorkingList({
                    engine,
                    id: list.id,
                    resource: list.resource,
                    existingResource: list.raw,
                    name: list.name,
                    configuration: resolvedConfiguration,
                    fields: fieldsForConfiguration(
                        metadata.fieldCatalog,
                        resolvedConfiguration
                    ),
                    capabilities: metadata.capabilities,
                    sharing: list.sharing,
                    serializationContext: metadata.serializationContext,
                })
            } catch (cause) {
                throw toTransportError(cause, 'Updating the saved working list')
            }
        },
        onSuccess: reloadSavedLists,
    })
}

/** Deletes a saved list; deleting the selected one returns to the default list. */
export const useDeleteSavedList = () => {
    const engine = useDataEngine()
    const reloadSavedLists = useReloadSavedLists()
    const { programId, viewId: selectedViewId, selectView } = useWorkingList()
    const { online } = useOnlineStatus()
    const { data: savedLists } = useSavedLists()

    return useMutation<void, DeleteViewError, string>({
        mutationKey: workingListQueryKeys.savedListMutations(programId),
        mutationFn: async (viewId) => {
            if (!online) {
                throw new OfflineMutationError({
                    message: 'Working lists cannot be deleted while offline',
                })
            }
            // Generated lists are not on the server, so there is nothing to delete.
            const list = savedLists?.generated
                ? undefined
                : savedLists?.lists.find((candidate) => candidate.id === viewId)
            if (!list) {
                throw new SavedListNotFoundError({
                    savedListId: viewId,
                    message: `Saved working list ${viewId} was not found`,
                })
            }
            if (list.sharing.access?.delete !== true) {
                throw new SavedListPermissionError({
                    savedListId: viewId,
                    operation: 'delete',
                    message: `Delete access to ${viewId} is required`,
                })
            }
            try {
                await deleteSavedWorkingList(engine, list.resource, viewId)
            } catch (cause) {
                throw toTransportError(cause, 'Deleting the saved working list')
            }
        },
        onSuccess: async (_deleted, viewId) => {
            if (selectedViewId === viewId) selectView(null)
            await reloadSavedLists()
        },
    })
}

/**
 * Writes a repaired configuration over a saved list that names fields the
 * program no longer has. Once the lists reload, the list reads as compatible.
 */
export const useRepairSavedList = () => {
    const engine = useDataEngine()
    const reloadSavedLists = useReloadSavedLists()
    const { programId } = useWorkingList()
    const { online } = useOnlineStatus()
    const { data: metadata } = useWorkingListMetadata()

    return useMutation<
        void,
        RepairSavedListError,
        {
            list: NormalizedSavedWorkingList
            configuration: InternalConfiguration
        }
    >({
        mutationKey: workingListQueryKeys.savedListMutations(programId),
        mutationFn: async ({ list, configuration }) => {
            if (!online) {
                throw new OfflineMutationError({
                    message: 'Working lists cannot be repaired while offline',
                })
            }
            if (!canUpdateSavedList(list)) {
                throw new SavedListPermissionError({
                    savedListId: list.id,
                    operation: 'update',
                    message: `Update access to ${list.id} is required to repair it`,
                })
            }
            if (!metadata || !savesToSameResource(list, configuration)) {
                throw new IncompatibleSavedListError({
                    savedListId: list.id,
                    message: 'Repair would change the saved-list resource type',
                })
            }
            try {
                await replaceSavedWorkingList({
                    engine,
                    id: list.id,
                    resource: list.resource,
                    existingResource: list.raw,
                    name: list.name,
                    configuration,
                    fields: fieldsForConfiguration(
                        metadata.fieldCatalog,
                        configuration
                    ),
                    capabilities: metadata.capabilities,
                    sharing: list.sharing,
                    serializationContext: metadata.serializationContext,
                })
            } catch (cause) {
                throw toTransportError(
                    cause,
                    'Repairing the saved working list'
                )
            }
        },
        onSuccess: reloadSavedLists,
    })
}

/** A saved-list write is under way, so nothing that changes the list should run. */
export const useIsSavingList = () => {
    const { programId } = useWorkingList()
    const writes = useIsMutating({
        mutationKey: workingListQueryKeys.savedListMutations(programId),
    })
    return writes > 0
}
