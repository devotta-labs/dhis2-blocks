import {
    WorkingList,
    WorkingListColumnSelector,
    WorkingListFilterControls,
    WorkingListTable,
    WorkingListToolbar,
    WorkingListToolbarActions,
    WorkingListViewSwitcher,
} from '@dhis2-blocks/working-list'
import { PreviewShell } from '../../preview/PreviewShell'

/**
 * The complete Working List against live DHIS2 tracker data.
 *
 * `IpHINAT79UW` (Child Programme) and `y77LiPqLMoq` (Ngelehun CHC) ship with
 * the Sierra Leone demo database — which the repository's documented backend
 * also seeds — so the example works on a fresh local stack and on any public
 * demo instance.
 */
const WorkingListDefault = () => (
    <PreviewShell>
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
    </PreviewShell>
)

export default WorkingListDefault
