import {
    WorkingList,
    WorkingListColumnSelector,
    WorkingListFilterControls,
    WorkingListTable,
    WorkingListToolbar,
    WorkingListToolbarActions,
    WorkingListViewSwitcher,
} from '@/components/working-list'
import type { LabView } from './labData'

interface Props {
    view: LabView
    programId: string
    orgUnitId: string
    defaultViewId?: string
    note: (entry: string) => void
}

export const TableCanvas = ({
    view,
    programId,
    orgUnitId,
    defaultViewId,
    note,
}: Props) => (
    <WorkingList
        // The page size is a default, so a new choice remounts the list.
        key={view.pageSize}
        programId={programId}
        orgUnitId={orgUnitId}
        defaultViewId={defaultViewId}
        defaultPagination={{ page: 1, pageSize: view.pageSize }}
        onViewChange={(id) => note(`onViewChange(${JSON.stringify(id)})`)}
        onPaginationChange={(next) =>
            note(`onPaginationChange(${JSON.stringify(next)})`)
        }
    >
        {view.viewSwitcher && <WorkingListViewSwitcher />}
        {view.toolbar && (
            <WorkingListToolbar>
                {view.columnSelector && <WorkingListColumnSelector />}
                {view.filterControls && <WorkingListFilterControls />}
                {view.actions && <WorkingListToolbarActions />}
            </WorkingListToolbar>
        )}
        <WorkingListTable
            dataQualityMode={view.dataQuality}
            onRowClick={
                view.clickable
                    ? (target) => note(`onRowClick(${JSON.stringify(target)})`)
                    : undefined
            }
        />
    </WorkingList>
)
