import {
    DataEntry,
    DataEntrySummary,
    DataGrid,
    eventSource,
    useDataEntry,
} from '@/components/data-entry'

/**
 * Everything that has happened to one person, across the program's stages.
 *
 * `PE6abx7Zhn0` is an enrollment in the WHO RMNCH Tracker (`WSGAb5XwJ3Y`) in
 * the DHIS2 Sierra Leone demo database, and `m7fBMpmVpSM` (Kolisokor MCHP) is
 * the organisation unit she is enrolled at. Her events are read wherever they
 * happened, oldest first; "Add event" adds another visit of stage
 * `edqlbukwRfQ`. Replace the ids with ones from your own instance.
 */

// Made once, outside the component: a source with new keys loads the form again.
const person = eventSource({
    programId: 'WSGAb5XwJ3Y',
    orgUnitId: 'm7fBMpmVpSM',
    enrollmentId: 'PE6abx7Zhn0',
    newRowStageId: 'edqlbukwRfQ',
    order: 'occurredAt:asc',
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

const PersonEventsGrid = () => (
    <DataEntry source={person}>
        <Status />
        <DataGrid />
        <DataEntrySummary />
    </DataEntry>
)

export default PersonEventsGrid
