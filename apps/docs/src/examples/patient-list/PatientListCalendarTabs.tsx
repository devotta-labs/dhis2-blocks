import { useState } from 'react'
import {
    ToggleGroup,
    ToggleGroupItem,
} from '@/components/dhis2/ui/toggle-group'
import {
    CalendarDayRecords,
    CalendarGrid,
    CalendarNavigation,
} from '@/components/calendar'
import {
    DataTableContent,
    DataTableFilters,
    DataTablePagination,
    DataTableToolbar,
} from '@/components/data-table'
import {
    PATIENT_LIST_PAGE_SIZES,
    PatientList,
    attributeColumn,
    attributeTextFilter,
    enrollmentStatusFilter,
    fieldColumn,
    usePatientList,
    type PatientListRow,
} from '@/components/patient-list'
import { PatientCalendar } from './PatientCalendar'

type Layout = 'table' | 'calendar'

const FIRST_NAME = 'w75KJ2mc4zz'
const LAST_NAME = 'zDhUuAYrxNC'

const columns = [
    attributeColumn(FIRST_NAME, { header: 'First name' }),
    attributeColumn(LAST_NAME, { header: 'Last name' }),
    fieldColumn('enrolledAt', {
        header: 'Enrolled',
        nowrap: true,
        format: (value) => value?.slice(0, 10),
    }),
    fieldColumn('enrollmentStatus', { header: 'Status' }),
]

const filters = [
    attributeTextFilter({
        attribute: FIRST_NAME,
        label: 'First name',
        pinned: true,
    }),
    enrollmentStatusFilter({ pinned: true }),
]

const fullName = (row: PatientListRow) =>
    [row.attributes[FIRST_NAME], row.attributes[LAST_NAME]]
        .filter(Boolean)
        .join(' ') || row.trackedEntity

/**
 * One patient list shown as a table or a calendar. Both read the same
 * filters, so switching keeps the user's place. The table only loads while
 * it shows; the calendar loads the weeks in view.
 *
 * `IpHINAT79UW` (Child Programme), `DiszpKrYNg8` (Ngelehun CHC) and the name
 * attributes exist in the DHIS2 Sierra Leone demo database. Replace them with
 * ids from your own instance.
 */
const PatientListCalendarTabs = () => {
    const [layout, setLayout] = useState<Layout>('calendar')
    const list = usePatientList({
        program: 'IpHINAT79UW',
        orgUnit: 'DiszpKrYNg8',
        columns,
        filters,
        enabled: layout === 'table',
        initialState: { pagination: { pageIndex: 0, pageSize: 10 } },
    })

    return (
        <PatientList list={list}>
            <DataTableToolbar>
                <DataTableFilters filters={list.filters} />
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
            </DataTableToolbar>
            {layout === 'table' ? (
                <>
                    <DataTableContent />
                    <DataTablePagination pageSizes={PATIENT_LIST_PAGE_SIZES} />
                </>
            ) : (
                <PatientCalendar
                    query={list.query}
                    recordLabel={fullName}
                    className="p-2"
                >
                    <CalendarNavigation />
                    <CalendarGrid />
                    <CalendarDayRecords />
                </PatientCalendar>
            )}
        </PatientList>
    )
}

export default PatientListCalendarTabs
