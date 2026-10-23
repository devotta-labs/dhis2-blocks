import { Alert, AlertTitle, ErrorAlert } from '@/components/dhis2/ui/alert'
import { Button } from '@/components/dhis2/ui/button'
import { Spinner } from '@/components/dhis2/ui/spinner'
import {
    TrackedEntityRecordProvider,
    useTrackedEntityRecord,
} from '@/components/tracked-entity-record'

/**
 * A person who is not available.
 *
 * `AbCdEfGhIjK` is a made-up ID that matches no one. The server answers a
 * person that does not exist and a person the user may not see the same way,
 * so the block reports both as `unavailable`: show one neutral message and
 * never say which it was.
 */
const Person = () => {
    const { state } = useTrackedEntityRecord()

    switch (state.status) {
        case 'pending':
            return <Spinner aria-label="Loading the record" />
        case 'unavailable':
            return (
                <Alert variant="warning">
                    <AlertTitle>This person is not available.</AlertTitle>
                    <p className="m-0">
                        They may not exist, or you may not have access.
                    </p>
                </Alert>
            )
        case 'error':
            return (
                <ErrorAlert title="The record could not be loaded.">
                    <Button variant="outline" onClick={state.retry}>
                        Try again
                    </Button>
                </ErrorAlert>
            )
        case 'ready':
            return <p>Found {state.record.person.id}.</p>
    }
}

const RecordUnavailable = () => (
    <TrackedEntityRecordProvider trackedEntityId="AbCdEfGhIjK">
        <Person />
    </TrackedEntityRecordProvider>
)

export default RecordUnavailable
