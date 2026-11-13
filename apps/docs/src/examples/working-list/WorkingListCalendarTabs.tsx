import { Pane } from '@/components/shell'
import { useState } from 'react'
import {
    ToggleGroup,
    ToggleGroupItem,
} from '@/components/dhis2/ui/toggle-group'
import {
    WorkingList,
    WorkingListColumnSelector,
    WorkingListFilterControls,
    WorkingListTable,
    WorkingListToolbar,
    WorkingListViewSwitcher,
} from '@/components/working-list'
import {
    CalendarDayRecords,
    CalendarGrid,
    CalendarNavigation,
} from '@/components/calendar'
import { ListCalendar } from './ListCalendar'

type Layout = 'table' | 'calendar'

/**
 * One working list shown as a table or a calendar. Both read the same saved
 * view and filters, so switching keeps the user's place.
 *
 * `IpHINAT79UW` (Child Programme) and `y77LiPqLMoq` (Ngelehun CHC) exist in
 * the DHIS2 Sierra Leone demo database. Replace them with a program and
 * organisation unit from your own instance.
 */
const WorkingListCalendarTabs = () => {
    const [layout, setLayout] = useState<Layout>('calendar')

    return (
        <Pane>
            <WorkingList programId="IpHINAT79UW" orgUnitId="y77LiPqLMoq">
                <WorkingListViewSwitcher />
                <WorkingListToolbar>
                    <WorkingListColumnSelector />
                    <WorkingListFilterControls />
                    <ToggleGroup
                        aria-label="Layout"
                        variant="outline"
                        size="sm"
                        className="ms-auto"
                        value={[layout]}
                    >
                        <ToggleGroupItem
                            value="table"
                            onClick={() => setLayout('table')}
                        >
                            Table
                        </ToggleGroupItem>
                        <ToggleGroupItem
                            value="calendar"
                            onClick={() => setLayout('calendar')}
                        >
                            Calendar
                        </ToggleGroupItem>
                    </ToggleGroup>
                </WorkingListToolbar>
                {layout === 'table' ? (
                    <WorkingListTable />
                ) : (
                    <ListCalendar className="p-2">
                        <CalendarNavigation />
                        <CalendarGrid />
                        <CalendarDayRecords />
                    </ListCalendar>
                )}
            </WorkingList>
        </Pane>
    )
}

export default WorkingListCalendarTabs
