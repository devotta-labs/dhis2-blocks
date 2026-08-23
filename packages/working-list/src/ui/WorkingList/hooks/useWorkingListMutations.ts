import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { WorkingListCapabilities } from '../../../api/capabilities'
import type { WorkingListClient } from '../../../api/client'
import type { ProgramFieldCatalog } from '../../../api/metadata'
import {
    createSavedWorkingList,
    deleteSavedWorkingList,
    replaceSavedWorkingList,
    type NormalizedSavedWorkingList,
} from '../../../api/savedLists'
import type { WorkingListConfiguration } from '../../../domain/model'
import { workingListQueryKeys } from '../../../query/keys'
import type { FilterSerializationContext } from '../../../registry/valueTypes'
import { useWorkingListText } from '../../WorkingListText'

export interface ReplaceWorkingListInput {
    list: NormalizedSavedWorkingList
    name: string
    nextConfiguration: WorkingListConfiguration
    selectAfterReplace?: boolean
}

interface WorkingListMutationsOptions {
    client: WorkingListClient
    programId: string
    configuration: WorkingListConfiguration
    metadata: ProgramFieldCatalog
    capabilities: WorkingListCapabilities
    serializationContext: FilterSerializationContext
    selectedListId?: string
    onCreated: (id: string) => void
    onAccepted: (input: ReplaceWorkingListInput) => void
    onRepaired: (list: NormalizedSavedWorkingList) => void
    onDeletedSelected: () => void
}

export const useWorkingListMutations = ({
    client,
    programId,
    configuration,
    metadata,
    capabilities,
    serializationContext,
    selectedListId,
    onCreated,
    onAccepted,
    onRepaired,
    onDeletedSelected,
}: WorkingListMutationsOptions) => {
    const translate = useWorkingListText()
    const queryClient = useQueryClient()
    const invalidateSavedLists = () =>
        queryClient.invalidateQueries({
            queryKey: workingListQueryKeys.savedLists(programId),
        })

    const createMutation = useMutation({
        mutationFn: (name: string) =>
            createSavedWorkingList({
                client,
                name,
                configuration,
                fields: metadata.fields,
                capabilities,
                serializationContext,
            }),
        onSuccess: async (id) => {
            onCreated(id)
            await invalidateSavedLists()
        },
    })
    const replaceMutation = useMutation({
        mutationFn: ({
            list,
            name,
            nextConfiguration,
        }: ReplaceWorkingListInput) => {
            const targetResource =
                nextConfiguration.mode === 'event'
                    ? 'programStageWorkingLists'
                    : 'trackedEntityInstanceFilters'
            if (list.resource !== targetResource) {
                throw new Error(
                    translate(
                        'Save this mode change as a new working list instead of replacing a different resource type.'
                    )
                )
            }
            return replaceSavedWorkingList({
                client,
                id: list.id,
                resource: list.resource,
                name,
                configuration: nextConfiguration,
                fields: metadata.fields,
                capabilities,
                sharing: list.sharing,
                existingResource: list.raw,
                serializationContext,
            })
        },
        onSuccess: async (_data, variables) => {
            if (variables.selectAfterReplace) {
                onRepaired({
                    id: variables.list.id,
                    name: variables.name,
                    resource: variables.list.resource,
                    sortOrder: variables.list.sortOrder,
                    sharing: variables.list.sharing,
                    compatibility: 'compatible',
                    configuration: variables.nextConfiguration,
                })
            } else {
                onAccepted(variables)
            }
            await invalidateSavedLists()
        },
    })
    const deleteMutation = useMutation({
        mutationFn: (list: NormalizedSavedWorkingList) =>
            deleteSavedWorkingList(client, list.resource, list.id),
        onSuccess: async (_data, list) => {
            await invalidateSavedLists()
            if (selectedListId === list.id) {
                onDeletedSelected()
            }
        },
    })

    return {
        createMutation,
        replaceMutation,
        deleteMutation,
        error:
            createMutation.error ??
            replaceMutation.error ??
            deleteMutation.error,
        busy:
            createMutation.isPending ||
            replaceMutation.isPending ||
            deleteMutation.isPending,
    }
}
