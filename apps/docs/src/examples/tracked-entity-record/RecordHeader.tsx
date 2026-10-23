import { ErrorAlert } from '@/components/dhis2/ui/alert'
import { Button } from '@/components/dhis2/ui/button'
import { Spinner } from '@/components/dhis2/ui/spinner'
import {
    TrackedEntityRecordProvider,
    displayAttributes,
    useTrackedEntityRecord,
} from '@/components/tracked-entity-record'

/**
 * A person header from the record's list attributes.
 *
 * `PQfMcpmXeFE` exists in the DHIS2 Sierra Leone demo database. Replace it
 * with a tracked entity ID from your own instance. Without a program,
 * `displayAttributes` lists the tracked entity type's attributes; pass a
 * program ID to list that program's instead.
 */
const PersonHeader = () => {
    const { state } = useTrackedEntityRecord()

    switch (state.status) {
        case 'pending':
            return <Spinner aria-label="Loading the record" />
        case 'unavailable':
            return <p>This person is not available.</p>
        case 'error':
            return (
                <ErrorAlert title="The record could not be loaded.">
                    <Button variant="outline" onClick={state.retry}>
                        Try again
                    </Button>
                </ErrorAlert>
            )
        case 'ready': {
            const { record } = state
            const attributes = displayAttributes(record, undefined, {
                onlyDisplayInList: true,
            })

            return (
                <header data-testid="record-header" className="grid gap-2">
                    <h3 className="m-0 text-lg font-medium">
                        {record.person.trackedEntityType.name}
                    </h3>
                    <dl className="m-0 flex flex-wrap gap-x-8 gap-y-2">
                        {attributes.map(({ attribute, value }) => (
                            <div key={attribute.id}>
                                <dt className="text-xs text-dhis2-grey-700">
                                    {attribute.name}
                                </dt>
                                <dd className="m-0 text-sm">{value ?? '—'}</dd>
                            </div>
                        ))}
                    </dl>
                </header>
            )
        }
    }
}

const RecordHeader = () => (
    <TrackedEntityRecordProvider trackedEntityId="PQfMcpmXeFE">
        <PersonHeader />
    </TrackedEntityRecordProvider>
)

export default RecordHeader
