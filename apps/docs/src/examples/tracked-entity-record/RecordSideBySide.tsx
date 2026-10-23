import { ErrorAlert } from '@/components/dhis2/ui/alert'
import { Button } from '@/components/dhis2/ui/button'
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/dhis2/ui/card'
import { Spinner } from '@/components/dhis2/ui/spinner'
import {
    TrackedEntityRecordProvider,
    enrollmentAllowance,
    useTrackedEntityRecord,
    type ProgramRecord,
    type TrackedEntityRecord,
} from '@/components/tracked-entity-record'

/**
 * Two programs side by side, from one provider.
 *
 * `PQfMcpmXeFE` is enrolled in Child Programme (`IpHINAT79UW`) and TB program
 * (`ur1Edk5Oe2n`) in the DHIS2 Sierra Leone demo database. Replace the IDs
 * with a person and programs from your own instance. `programs` lists the
 * programs the app cares about, in the order it wants them.
 */
type ProgramCardProps = { record: TrackedEntityRecord; entry: ProgramRecord }

const ProgramCard = ({ record, entry }: ProgramCardProps) => {
    if (entry.status === 'unavailable') {
        // The block never says why a program is locked.
        return (
            <section aria-label={entry.programId}>
                <p>You don't have access to this program's records.</p>
            </section>
        )
    }

    if (entry.status === 'error') {
        return (
            <section aria-label={entry.programId}>
                <ErrorAlert title="This program could not be loaded.">
                    <Button variant="outline" onClick={entry.retry}>
                        Try again
                    </Button>
                </ErrorAlert>
            </section>
        )
    }

    const allowance = enrollmentAllowance(record, entry)

    return (
        <section aria-label={entry.program.name}>
            <Card>
                <CardHeader>
                    <CardTitle>{entry.program.name}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2 text-sm">
                    <p className="m-0">
                        {entry.status === 'enrolled'
                            ? 'Enrolled'
                            : 'Not enrolled'}
                    </p>
                    {entry.status === 'enrolled' && (
                        <ul className="m-0 list-none p-0">
                            {entry.enrollments.map((enrollment) => (
                                <li key={enrollment.id}>
                                    {enrollment.enrolledAt.slice(0, 10)} ·{' '}
                                    {enrollment.status.toLowerCase()}
                                </li>
                            ))}
                        </ul>
                    )}
                    <p className="m-0 text-dhis2-grey-700">
                        {allowance.allowed
                            ? 'A new enrollment can be started.'
                            : 'A new enrollment cannot be started.'}
                    </p>
                </CardContent>
            </Card>
        </section>
    )
}

const Programs = () => {
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
        case 'ready':
            return (
                <div className="grid gap-4 md:grid-cols-2">
                    {[...state.record.programs].map(([id, entry]) => (
                        <ProgramCard
                            key={id}
                            record={state.record}
                            entry={entry}
                        />
                    ))}
                </div>
            )
    }
}

const RecordSideBySide = () => (
    <TrackedEntityRecordProvider
        trackedEntityId="PQfMcpmXeFE"
        programs={['IpHINAT79UW', 'ur1Edk5Oe2n']}
    >
        <Programs />
    </TrackedEntityRecordProvider>
)

export default RecordSideBySide
