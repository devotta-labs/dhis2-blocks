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
    currentEnrollment,
    eventStatus,
    latestValues,
    todayIso,
    useTrackedEntityRecord,
    type DerivedEventStatus,
} from '@/components/tracked-entity-record'

/**
 * Latest values and visits for one enrollment.
 *
 * `PQfMcpmXeFE` and the TB program `ur1Edk5Oe2n` exist in the DHIS2 Sierra
 * Leone demo database. Replace them with a person and program from your own
 * instance. `eventStatus` tells upcoming and overdue visits apart from the
 * stored status and today's date; `latestValues` picks the newest value of
 * each data element.
 */
const PROGRAM_ID = 'ur1Edk5Oe2n'

const statusLabels = {
    active: 'In progress',
    completed: 'Completed',
    scheduled: 'Upcoming',
    overdue: 'Overdue',
    skipped: 'Skipped',
} satisfies Record<DerivedEventStatus, string>

const Visits = () => {
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
            const entry = state.record.programs.get(PROGRAM_ID)

            if (entry?.status === 'unavailable') {
                // Never "not enrolled": the person may be enrolled elsewhere.
                return <p>You don't have access to this program's records.</p>
            }
            if (entry?.status === 'error') {
                return (
                    <ErrorAlert title="This program could not be loaded.">
                        <Button variant="outline" onClick={entry.retry}>
                            Try again
                        </Button>
                    </ErrorAlert>
                )
            }

            const enrollment = entry && currentEnrollment(entry)

            if (entry?.status !== 'enrolled' || !enrollment) {
                return <p>No current enrollment in this program.</p>
            }

            const { program } = entry
            const today = todayIso()
            const stageNames = new Map(
                program.stages.map(({ id, name }) => [id, name])
            )
            // A data element used in several stages is listed once.
            const dataElements = new Map(
                program.stages.flatMap(({ dataElements }) => [...dataElements])
            )
            const reported = [...dataElements.values()].filter(
                ({ displayInReports }) => displayInReports
            )
            const latest = latestValues(
                enrollment.events,
                reported.map(({ id }) => id)
            )

            return (
                <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Latest values</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <dl className="m-0 grid gap-2 text-sm">
                                {reported.map(({ id, name }) => {
                                    const value = latest.get(id)?.value

                                    return value === undefined ? null : (
                                        <div key={id}>
                                            <dt className="text-xs text-dhis2-grey-700">
                                                {name}
                                            </dt>
                                            <dd className="m-0">{value}</dd>
                                        </div>
                                    )
                                })}
                            </dl>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>Visits</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ul
                                aria-label="Visits"
                                className="m-0 grid list-none gap-2 p-0 text-sm"
                            >
                                {enrollment.events.map((event) => (
                                    <li
                                        key={event.event}
                                        className="flex flex-wrap gap-x-3"
                                    >
                                        <span>
                                            {stageNames.get(
                                                event.programStage
                                            ) ?? event.programStage}
                                        </span>
                                        <span>
                                            {(
                                                event.occurredAt ??
                                                event.scheduledAt ??
                                                ''
                                            ).slice(0, 10)}
                                        </span>
                                        <span>
                                            {
                                                statusLabels[
                                                    eventStatus(event, today)
                                                ]
                                            }
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>
                </div>
            )
        }
    }
}

const RecordVisits = () => (
    <TrackedEntityRecordProvider
        trackedEntityId="PQfMcpmXeFE"
        programs={[PROGRAM_ID]}
    >
        <Visits />
    </TrackedEntityRecordProvider>
)

export default RecordVisits
