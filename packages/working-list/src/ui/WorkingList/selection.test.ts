import {
    isUnavailableSelectedTemplate,
    resolveWorkingListStatus,
    WorkingListStatuses,
} from './selection'

const input = {
    selectedTemplateId: 'MissingList1',
    defaultTemplateId: 'Program0001-default',
    availableTemplateIds: ['SavedList01'],
    savedListsResolved: true,
    savedListsFetching: false,
}

describe('controlled working-list selection', () => {
    it('marks a settled external selection as unavailable when it is not displayed', () => {
        expect(isUnavailableSelectedTemplate(input)).toBe(true)
    })

    it.each([
        {
            name: 'the generated default',
            changes: { selectedTemplateId: input.defaultTemplateId },
        },
        {
            name: 'a displayed saved list',
            changes: { selectedTemplateId: input.availableTemplateIds[0] },
        },
        {
            name: 'an undefined host selection',
            changes: { selectedTemplateId: undefined },
        },
        {
            name: 'a selection while saved lists are loading',
            changes: { savedListsResolved: false },
        },
        {
            name: 'a selection while saved lists are refetching',
            changes: { savedListsFetching: true },
        },
        {
            name: 'a just-created list awaiting a reload',
            changes: { pendingCreatedTemplateId: input.selectedTemplateId },
        },
    ])('does not mark $name as unavailable', ({ changes }) => {
        expect(isUnavailableSelectedTemplate({ ...input, ...changes })).toBe(
            false
        )
    })

    it('keeps the just-created reload error distinct from an arbitrary invalid id', () => {
        expect(
            resolveWorkingListStatus({
                ...input,
                pendingCreatedTemplateId: input.selectedTemplateId,
            })
        ).toBe(WorkingListStatuses.CREATED_LIST_RELOAD_ERROR)
        expect(resolveWorkingListStatus(input)).toBe(
            WorkingListStatuses.INVALID_TEMPLATE_ID
        )
    })
})
