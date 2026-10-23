import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/dhis2/ui/card'
import {
    latestValues,
    type Enrollment,
    type ProgramInfo,
} from '@/components/tracked-entity-record'
import React from 'react'
import i18n from '../../i18n'
import { day } from './day'

type LatestValuesProps = { program: ProgramInfo; enrollment: Enrollment }

/** Recipe: the newest value of each readable data element in this enrollment. */
export const LatestValues = ({ program, enrollment }: LatestValuesProps) => {
    const latest = latestValues(enrollment.events)
    const fields = new Map(
        program.stages.flatMap((stage) => [...stage.dataElements])
    )
    const rows = [...fields.values()].filter((field) => latest.has(field.id))
    return (
        <Card data-testid="latest-values">
            <CardHeader>
                <CardTitle>{i18n.t('Latest values')}</CardTitle>
            </CardHeader>
            <CardContent>
                {rows.length === 0 ? (
                    <p className="m-0 text-sm">
                        {i18n.t('No values recorded yet.')}
                    </p>
                ) : (
                    <dl className="m-0 grid gap-2">
                        {rows.map((field) => {
                            const entry = latest.get(field.id)
                            const value = entry?.value ?? ''
                            const option = field.optionSet?.options.find(
                                ({ code }) => code === value
                            )
                            return (
                                <div key={field.id}>
                                    <dt className="text-xs text-dhis2-grey-700">
                                        {field.name}
                                    </dt>
                                    <dd className="m-0 text-sm">
                                        {option?.name ?? value}{' '}
                                        <span className="text-xs text-dhis2-grey-700">
                                            {day(
                                                entry?.event.occurredAt ??
                                                    entry?.event.scheduledAt
                                            )}
                                        </span>
                                    </dd>
                                </div>
                            )
                        })}
                    </dl>
                )}
            </CardContent>
        </Card>
    )
}
