import { createRoot } from 'react-dom/client'
import { ContextSelector } from '@/components/context-selector'
import { SpreadsheetGrid } from '@/components/spreadsheet'
import { TrackerDataEntry, eventSource } from '@/components/tracker-data-entry'
import {
    ObservationCard,
    ObservationsProvider,
} from '@/components/observation-cards'
import {
    PatientList,
    attributeColumn,
    usePatientList,
} from '@/components/patient-list'
import {
    CalendarGrid,
    CalendarNavigation,
    CalendarDayRecords,
} from '@/components/calendar'
import { PatientCalendar } from './PatientCalendar'
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupTrigger,
    SidebarItem,
    SidebarItems,
    SidebarLink,
    SidebarNavigation,
    SidebarProvider,
    SidebarToggle,
} from '@/components/sidebar'
import { Host } from './host'
import './index.css'

const events = eventSource({ programId: 'program', orgUnitId: 'orgUnit' })

const patientColumns = [attributeColumn('attribute', { header: 'Name' })]

const Patients = () => {
    const list = usePatientList({
        program: 'program',
        orgUnit: 'orgUnit',
        columns: patientColumns,
    })
    return (
        <>
            <PatientList list={list} />
            <PatientCalendar
                query={list.query}
                recordLabel={(row) => row.trackedEntity}
            >
                <CalendarNavigation />
                <CalendarGrid />
                <CalendarDayRecords />
            </PatientCalendar>
        </>
    )
}

// Type-level use only: the check compiles and bundles this file, never runs it.
const root = document.getElementById('root')
if (root !== null) {
    createRoot(root).render(
        <>
            <Host />
            <SidebarProvider>
                <Sidebar>
                    <SidebarNavigation>
                        <SidebarContent>
                            <SidebarItems>
                                <SidebarGroup defaultOpen>
                                    <SidebarGroupTrigger>
                                        Evaluate
                                    </SidebarGroupTrigger>
                                    <SidebarGroupContent>
                                        <SidebarItem>
                                            <SidebarLink
                                                href="/evaluate"
                                                aria-current="page"
                                            >
                                                Overview
                                            </SidebarLink>
                                        </SidebarItem>
                                    </SidebarGroupContent>
                                </SidebarGroup>
                            </SidebarItems>
                        </SidebarContent>
                    </SidebarNavigation>
                    <SidebarToggle />
                </Sidebar>
            </SidebarProvider>
            <ContextSelector>{null}</ContextSelector>
            <ObservationsProvider trackedEntity="person" program="program">
                <ObservationCard dataElement="dataElement" unit="kg" />
            </ObservationsProvider>
            <Patients />
            <TrackerDataEntry source={events}>
                <SpreadsheetGrid />
            </TrackerDataEntry>
        </>
    )
}
