import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/dhis2/ui/card'
import {
    eventStatus,
    todayIso,
    type DerivedEventStatus,
    type Enrollment,
    type ProgramInfo,
} from '@/components/tracked-entity-record'
import React from 'react'
import i18n from '../../i18n'
import { day } from './day'

type VisitsProps = { program: ProgramInfo; enrollment: Enrollment }

const statusLabels = () =>
    ({
        overdue: i18n.t('Overdue'),
        scheduled: i18n.t('Upcoming'),
        active: i18n.t('In progress'),
        completed: i18n.t('Completed'),
        skipped: i18n.t('Skipped'),
    }) satisfies Record<DerivedEventStatus, string>

/** Recipe: the enrollment's events with upcoming and overdue told apart. */
export const Visits = ({ program, enrollment }: VisitsProps) => {
    const today = todayIso()
    const labels = statusLabels()
    const stageNames = new Map(program.stages.map(({ id, name }) => [id, name]))
    return (
        <Card data-testid="visits">
            <CardHeader>
                <CardTitle>{i18n.t('Visits')}</CardTitle>
            </CardHeader>
            <CardContent>
                {enrollment.events.length === 0 ? (
                    <p className="m-0 text-sm">{i18n.t('No visits yet.')}</p>
                ) : (
                    <ul className="m-0 grid list-none gap-2 p-0">
                        {enrollment.events.map((event) => {
                            const status = eventStatus(event, today)
                            return (
                                <li
                                    key={event.event}
                                    data-testid={`visit-${event.event}`}
                                    className="flex flex-wrap gap-x-3 text-sm"
                                >
                                    <span>
                                        {stageNames.get(event.programStage) ??
                                            event.programStage}
                                    </span>
                                    <span>
                                        {day(
                                            event.occurredAt ??
                                                event.scheduledAt
                                        )}
                                    </span>
                                    <span
                                        className={
                                            status === 'overdue'
                                                ? 'font-medium text-dhis2-red-700'
                                                : undefined
                                        }
                                    >
                                        {labels[status]}
                                    </span>
                                </li>
                            )
                        })}
                    </ul>
                )}
            </CardContent>
        </Card>
    )
}
