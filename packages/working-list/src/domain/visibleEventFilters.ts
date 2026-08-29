import type { WorkingListConfiguration } from '../provider/contracts'

export const visibleEventFiltersAfterStageChange = ({
    configuration,
    stageId,
    visibleFilterIds,
    addedFilterId,
}: {
    configuration: WorkingListConfiguration
    stageId?: string
    visibleFilterIds: string[]
    addedFilterId?: string
}) => {
    const stageChanged =
        Boolean(stageId) &&
        (configuration.mode !== 'event' ||
            configuration.programStageId !== stageId)
    const nextIds = stageChanged ? [] : visibleFilterIds
    return addedFilterId && !nextIds.includes(addedFilterId)
        ? [...nextIds, addedFilterId]
        : nextIds
}
