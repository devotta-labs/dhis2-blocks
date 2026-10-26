import {
    DataEntry,
    DataEntrySummary,
    DataGrid,
    eventSource,
    useDataEntry,
} from '@/components/data-entry'

/**
 * One stage of a tracker program, across many people.
 *
 * `WSGAb5XwJ3Y` (WHO RMNCH Tracker), its stage `WZbXY0S00lP` (First antenatal
 * care visit) and `ImspTQPwCqd` (Sierra Leone) exist in the DHIS2 Sierra Leone
 * demo database. The rows are the 50 most recent first visits at or below the
 * organisation unit; replace the ids with ones from your own instance.
 */

// Made once, outside the component: a source with new keys loads the form again.
const firstVisits = eventSource({
    programId: 'WSGAb5XwJ3Y',
    programStageId: 'WZbXY0S00lP',
    orgUnitId: 'ImspTQPwCqd',
    orgUnitMode: 'DESCENDANTS',
    pageSize: 50,
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

const TrackerRegisterGrid = () => (
    <DataEntry source={firstVisits}>
        <Status />
        <DataGrid />
        <DataEntrySummary />
    </DataEntry>
)

export default TrackerRegisterGrid
