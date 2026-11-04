import { useState, type ReactNode } from 'react'
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
    WorkingListCalendar,
    WorkingListCalendarCellRecords,
    WorkingListCalendarDayRecords,
    WorkingListCalendarDisplayToggle,
    WorkingListCalendarGrid,
    WorkingListCalendarNavigation,
} from '@/components/working-list-calendar'
import {
    recordLabelFor,
    recordStatusFor,
    weekendFor,
    type LabView,
} from './labData'
import { PlainCount } from './panels'

interface Props {
    view: LabView
    programId: string
    orgUnitId: string
    defaultViewId?: string
    note: (entry: string) => void
}

export const CalendarCanvas = ({
    view,
    programId,
    orgUnitId,
    defaultViewId,
    note,
}: Props) => {
    const [selectedDay, setSelectedDay] = useState<string | null>(null)
    const [toggle, setToggle] = useState<'table' | 'calendar'>('calendar')
    const onSelectedDayChange = (day: string | null) => {
        note(`onSelectedDayChange(${day === null ? 'null' : `'${day}'`})`)
        setSelectedDay(day)
    }
    const dayProps = view.controlledDay
        ? { selectedDay, onSelectedDayChange }
        : { onSelectedDayChange }

    const calendar = (
        <WorkingListCalendar
            // The display is a default, so a new choice remounts the calendar.
            key={view.display}
            className="p-2"
            defaultDisplay={view.display}
            onDisplayChange={(display) => note(`onDisplayChange('${display}')`)}
            recordStatus={recordStatusFor(view)}
            dateField={
                view.dateField === 'default' ? undefined : view.dateField
            }
            limit={view.limit}
            recordLabel={recordLabelFor(view)}
            onRecordClick={
                view.clickable
                    ? (target) =>
                          note(`onRecordClick(${JSON.stringify(target)})`)
                    : undefined
            }
            {...dayProps}
        >
            {view.navigation && (
                <div className="flex flex-wrap items-center gap-2">
                    <WorkingListCalendarNavigation />
                    {view.displayToggle && (
                        <WorkingListCalendarDisplayToggle className="ms-auto" />
                    )}
                </div>
            )}
            {view.grid && (
                <WorkingListCalendarGrid
                    weekend={weekendFor(view)}
                    weekendColumns={view.weekendColumns}
                >
                    {view.cell === 'records' && (
                        <WorkingListCalendarCellRecords max={view.perDay} />
                    )}
                    {view.cell === 'plainCount' && <PlainCount />}
                </WorkingListCalendarGrid>
            )}
            {view.dayRecords && <WorkingListCalendarDayRecords />}
        </WorkingListCalendar>
    )
    const table = (
        <WorkingListTable
            onRowClick={(target) =>
                note(`onRowClick(${JSON.stringify(target)})`)
            }
        />
    )

    let body: ReactNode = calendar
    if (view.layout === 'both') {
        body = (
            <div className="grid gap-2 xl:grid-cols-2">
                {table}
                {calendar}
            </div>
        )
    }
    if (view.layout === 'toggle') body = toggle === 'table' ? table : calendar
    // Columns are the table's; a calendar has none to choose.
    const showsTable =
        view.layout === 'both' ||
        (view.layout === 'toggle' && toggle === 'table')

    return (
        <WorkingList
            programId={programId}
            orgUnitId={orgUnitId}
            defaultViewId={defaultViewId}
            onViewChange={(id) => note(`onViewChange(${JSON.stringify(id)})`)}
        >
            {view.toolbar && <WorkingListViewSwitcher />}
            {view.toolbar && (
                <WorkingListToolbar>
                    {showsTable && <WorkingListColumnSelector />}
                    <WorkingListFilterControls />
                    {view.layout === 'toggle' && (
                        <ToggleGroup
                            aria-label="Layout"
                            variant="outline"
                            size="sm"
                            className="ms-auto"
                            value={[toggle]}
                        >
                            <ToggleGroupItem
                                value="table"
                                onClick={() => setToggle('table')}
                            >
                                Table
                            </ToggleGroupItem>
                            <ToggleGroupItem
                                value="calendar"
                                onClick={() => setToggle('calendar')}
                            >
                                Calendar
                            </ToggleGroupItem>
                        </ToggleGroup>
                    )}
                </WorkingListToolbar>
            )}
            {body}
        </WorkingList>
    )
}
