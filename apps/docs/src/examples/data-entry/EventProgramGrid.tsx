import {
    DataEntry,
    DataEntrySummary,
    DataGrid,
    eventSource,
    useDataEntry,
} from '@/components/data-entry'

/**
 * The events of an event program, one row per event.
 *
 * `eBAyeGv0exc` (Inpatient morbidity and mortality) and `DiszpKrYNg8`
 * (Ngelehun CHC) exist in the DHIS2 Sierra Leone demo database. Replace them
 * with a program and organisation unit from your own instance.
 */

// Made once, outside the component: a source with new keys loads the form again.
const inpatient = eventSource({
    programId: 'eBAyeGv0exc',
    orgUnitId: 'DiszpKrYNg8',
    orgUnitMode: 'SELECTED',
})

// Replace with your app's loading and error states.
const Status = () => {
    const status = useDataEntry((view) => view.status)

    return status === 'ready' ? null : (
        <p role="status" className="text-sm text-dhis2-grey-700">
            {status === 'loading' ? 'Loading…' : 'The form could not be loaded'}
        </p>
    )
}

const EventProgramGrid = () => (
    <DataEntry source={inpatient}>
        <Status />
        <DataGrid />
        <DataEntrySummary />
    </DataEntry>
)

export default EventProgramGrid
