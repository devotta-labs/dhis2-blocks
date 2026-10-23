import type { WorkingListCapabilities } from '../api/capabilities'
import type { WorkingListClient } from '../api/client'
import {
    fieldsForConfiguration,
    type ProgramFieldCatalog,
} from '../api/metadata'
import {
    replaceSavedWorkingList,
    type NormalizedSavedWorkingList,
} from '../api/savedLists'
import type { WorkingListConfiguration } from '../domain/model'
import type { FilterSerializationContext } from '../registry/valueTypes'
import { internalConfigurationFingerprint } from './configuration'
import { WorkingListInvalidResponseError } from './errors'

interface PersistSavedListOptions {
    client: WorkingListClient
    list: NormalizedSavedWorkingList
    configuration: WorkingListConfiguration
    metadata: ProgramFieldCatalog
    capabilities: WorkingListCapabilities
    serializationContext?: FilterSerializationContext
    refreshSavedLists: () => Promise<NormalizedSavedWorkingList[]>
    operation: 'updateSelectedView' | 'repairSelectedSavedList'
}

export const persistSavedList = async ({
    client,
    list,
    configuration,
    metadata,
    capabilities,
    serializationContext,
    refreshSavedLists,
    operation,
}: PersistSavedListOptions) => {
    await replaceSavedWorkingList({
        client,
        id: list.id,
        resource: list.resource,
        existingResource: list.raw,
        name: list.name,
        configuration,
        fields: fieldsForConfiguration(metadata, configuration),
        capabilities,
        sharing: list.sharing,
        serializationContext,
    })
    const lists = await refreshSavedLists()
    const confirmed = lists.find((candidate) => candidate.id === list.id)

    if (
        !confirmed ||
        confirmed.compatibility !== 'compatible' ||
        internalConfigurationFingerprint(confirmed.configuration) !==
            internalConfigurationFingerprint(configuration)
    ) {
        throw new WorkingListInvalidResponseError({
            operation,
            message:
                operation === 'updateSelectedView'
                    ? `Updated saved list ${list.id} did not match the submitted configuration after canonical refresh`
                    : `Repaired saved list ${list.id} did not match the submitted repair after canonical refresh`,
        })
    }

    return confirmed
}
