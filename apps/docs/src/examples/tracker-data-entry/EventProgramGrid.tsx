import { SpreadsheetGrid } from '@/components/spreadsheet'
import {
    TrackerDataEntry,
    TrackerDataEntrySummary,
    eventSource,
    useTrackerDataEntry,
} from '@/components/tracker-data-entry'

const inpatient = eventSource({
    programId: 'eBAyeGv0exc',
    orgUnitId: 'DiszpKrYNg8',
    orgUnitMode: 'SELECTED',
})

const Status = () => {
    const status = useTrackerDataEntry((view) => view.status)

    return status === 'ready' ? null : (
        <p role="status" className="text-sm text-dhis2-muted-foreground">
            {status === 'loading' ? 'Loading…' : 'The form could not be loaded'}
        </p>
    )
}

const EventProgramGrid = () => (
    <TrackerDataEntry source={inpatient}>
        <Status />
        <SpreadsheetGrid />
        <TrackerDataEntrySummary />
    </TrackerDataEntry>
)

/**
 * The events of an event program, one row per event.
 *
 * `eBAyeGv0exc` (Inpatient morbidity and mortality) and `DiszpKrYNg8`
 * (Ngelehun CHC) exist in the DHIS2 Sierra Leone demo database. Replace them
 * with a program and organisation unit from your own instance.
 */
export default EventProgramGrid
