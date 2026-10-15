import {
    WorkingList,
    WorkingListColumnSelector,
    WorkingListFilterControls,
    WorkingListTable,
    WorkingListToolbar,
    WorkingListToolbarActions,
    WorkingListViewSwitcher,
} from '@/components/working-list'

/**
 * The complete Working List.
 *
 * `IpHINAT79UW` (Child Programme) and `y77LiPqLMoq` (Ngelehun CHC) exist in
 * the DHIS2 Sierra Leone demo database. Replace them with a program and
 * organisation unit from your own instance.
 */
const WorkingListDefault = () => (
    <WorkingList
        programId="IpHINAT79UW"
        orgUnitId="y77LiPqLMoq"
        defaultPagination={{ page: 1, pageSize: 10 }}
    >
        <WorkingListViewSwitcher />
        <WorkingListToolbar>
            <WorkingListColumnSelector />
            <WorkingListFilterControls />
            <WorkingListToolbarActions />
        </WorkingListToolbar>
        <WorkingListTable />
    </WorkingList>
)

export default WorkingListDefault
