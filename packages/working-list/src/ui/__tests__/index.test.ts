import * as packageSurface from '../../index'

describe('working-list public source surface', () => {
    it('exports only the canonical API, selector hooks, constants, and tagged errors', () => {
        expect(Object.keys(packageSurface).sort()).toEqual(
            [
                'DownloadVisibleRowsError',
                'IncompatibleSavedListError',
                'InvalidConfigurationError',
                'InvalidPaginationError',
                'NoSelectedSavedListError',
                'OfflineMutationError',
                'SavedListNotFoundError',
                'SavedListPermissionError',
                'UnknownFieldError',
                'UnknownProgramStageError',
                'WORKING_LIST_PAGE_SIZES',
                'WorkingList',
                'WorkingListColumnSelector',
                'WorkingListFilterControls',
                'WorkingListInitializationError',
                'WorkingListInvalidResponseError',
                'WorkingListNetworkError',
                'WorkingListResultsError',
                'WorkingListTable',
                'WorkingListToolbar',
                'WorkingListToolbarActions',
                'WorkingListViewSwitcher',
                'useWorkingListActions',
                'useWorkingListMeta',
                'useWorkingListState',
            ].sort()
        )
    })

    it('does not attach legacy compound components to the root', () => {
        expect(Object.keys(packageSurface.WorkingList)).toEqual([])
    })
})
