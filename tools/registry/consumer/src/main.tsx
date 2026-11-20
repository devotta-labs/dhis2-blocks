import { createRoot } from 'react-dom/client'
import { ContextSelector } from '@/components/context-selector'
import { SpreadsheetGrid } from '@/components/spreadsheet'
import { TrackerDataEntry, eventSource } from '@/components/tracker-data-entry'
import {
    ObservationCard,
    ObservationsProvider,
} from '@/components/observation-cards'
import { WorkingList } from '@/components/working-list'
import {
    CalendarGrid,
    CalendarNavigation,
    CalendarDayRecords,
} from '@/components/calendar'
import { ListCalendar } from './ListCalendar'
import { Host } from './host'
import './index.css'

const events = eventSource({ programId: 'program', orgUnitId: 'orgUnit' })

// Type-level use only: the check compiles and bundles this file, never runs it.
const root = document.getElementById('root')
if (root !== null) {
    createRoot(root).render(
        <>
            <Host />
            <ContextSelector>{null}</ContextSelector>
            <ObservationsProvider trackedEntity="person" program="program">
                <ObservationCard dataElement="dataElement" unit="kg" />
            </ObservationsProvider>
            <WorkingList programId="program" orgUnitId="orgUnit">
                <ListCalendar>
                    <CalendarNavigation />
                    <CalendarGrid />
                    <CalendarDayRecords />
                </ListCalendar>
            </WorkingList>
            <TrackerDataEntry source={events}>
                <SpreadsheetGrid />
            </TrackerDataEntry>
        </>
    )
}
