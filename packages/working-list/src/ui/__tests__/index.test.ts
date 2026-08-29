import * as packageSurface from '../../index'

describe('working-list public source surface', () => {
    it('exports only the compound API, selector hooks, constants, and tagged errors', () => {
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
                'WorkingListInitializationError',
                'WorkingListInvalidResponseError',
                'WorkingListNetworkError',
                'WorkingListResultsError',
                'useWorkingListActions',
                'useWorkingListMeta',
                'useWorkingListState',
            ].sort()
        )
    })

    it('exposes the documented compound components', () => {
        expect(Object.keys(packageSurface.WorkingList)).toEqual([
            'Provider',
            'Container',
            'Section',
            'SavedViews',
            'Toolbar',
            'Columns',
            'Filters',
            'Actions',
            'Results',
            'Default',
        ])
    })
})
