export const WorkingListStatuses = {
    LOADING: 'LOADING',
    READY: 'READY',
    INVALID_TEMPLATE_ID: 'INVALID_TEMPLATE_ID',
    CREATED_LIST_RELOAD_ERROR: 'CREATED_LIST_RELOAD_ERROR',
    INCOMPATIBLE_TEMPLATE: 'INCOMPATIBLE_TEMPLATE',
} satisfies {
    LOADING: 'LOADING'
    READY: 'READY'
    INVALID_TEMPLATE_ID: 'INVALID_TEMPLATE_ID'
    CREATED_LIST_RELOAD_ERROR: 'CREATED_LIST_RELOAD_ERROR'
    INCOMPATIBLE_TEMPLATE: 'INCOMPATIBLE_TEMPLATE'
}

interface UnavailableSelectedTemplateInput {
    selectedTemplateId?: string
    defaultTemplateId: string
    availableTemplateIds: readonly string[]
    pendingCreatedTemplateId?: string
    savedListsResolved: boolean
    savedListsFetching: boolean
}

export const isUnavailableSelectedTemplate = ({
    selectedTemplateId,
    defaultTemplateId,
    availableTemplateIds,
    pendingCreatedTemplateId,
    savedListsResolved,
    savedListsFetching,
}: UnavailableSelectedTemplateInput) =>
    selectedTemplateId !== undefined &&
    selectedTemplateId !== defaultTemplateId &&
    selectedTemplateId !== pendingCreatedTemplateId &&
    savedListsResolved &&
    !savedListsFetching &&
    !availableTemplateIds.includes(selectedTemplateId)

interface WorkingListStatusInput extends UnavailableSelectedTemplateInput {
    appliedTemplateId?: string
    selectedTemplateCompatibility?: 'compatible' | 'incompatible'
}

export const resolveWorkingListStatus = (input: WorkingListStatusInput) => {
    const {
        selectedTemplateId,
        defaultTemplateId,
        availableTemplateIds,
        pendingCreatedTemplateId,
        savedListsResolved,
        savedListsFetching,
        appliedTemplateId,
        selectedTemplateCompatibility,
    } = input
    const createdListReloadMissing =
        pendingCreatedTemplateId !== undefined &&
        pendingCreatedTemplateId === selectedTemplateId &&
        savedListsResolved &&
        !savedListsFetching &&
        !availableTemplateIds.includes(pendingCreatedTemplateId)
    if (createdListReloadMissing) {
        return WorkingListStatuses.CREATED_LIST_RELOAD_ERROR
    }
    if (isUnavailableSelectedTemplate(input)) {
        return WorkingListStatuses.INVALID_TEMPLATE_ID
    }
    if (selectedTemplateCompatibility === 'incompatible') {
        return WorkingListStatuses.INCOMPATIBLE_TEMPLATE
    }
    if (
        savedListsResolved &&
        appliedTemplateId === (selectedTemplateId ?? defaultTemplateId)
    ) {
        return WorkingListStatuses.READY
    }
    return WorkingListStatuses.LOADING
}
