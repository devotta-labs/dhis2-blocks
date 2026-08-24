import { WorkingListProvider } from '../../provider/WorkingListProvider'
import { WorkingListActions } from '../Actions'
import { WorkingListColumns } from '../Columns'
import { WorkingListContainer } from '../Container'
import { WorkingListDefault } from '../Default'
import { WorkingListFilters } from '../Filters'
import { WorkingListResults } from '../Results'
import { WorkingListSavedViews } from '../SavedViews'
import { WorkingListSection } from '../Section'
import { WorkingListToolbar } from '../Toolbar'

export const WorkingList = {
    Provider: WorkingListProvider,
    Container: WorkingListContainer,
    Section: WorkingListSection,
    SavedViews: WorkingListSavedViews,
    Toolbar: WorkingListToolbar,
    Columns: WorkingListColumns,
    Filters: WorkingListFilters,
    Actions: WorkingListActions,
    Results: WorkingListResults,
    Default: WorkingListDefault,
} as const
