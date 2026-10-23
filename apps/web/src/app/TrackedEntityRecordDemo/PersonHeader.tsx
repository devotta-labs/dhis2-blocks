import {
    displayAttributes,
    type TrackedEntityRecord,
} from '@/components/tracked-entity-record'
import React from 'react'
import i18n from '../../i18n'

type PersonHeaderProps = { record: TrackedEntityRecord; programId?: string }

/** Recipe: the person's list attributes, from the program shown (or the type). */
export const PersonHeader = ({ record, programId }: PersonHeaderProps) => {
    const attributes = displayAttributes(record, programId, {
        onlyDisplayInList: true,
    })
    return (
        <header data-testid="person-header" className="flex flex-col gap-2">
            <h2 className="m-0 text-lg font-medium">
                {record.person.trackedEntityType.name}
            </h2>
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
            {record.person.inactive && (
                <p className="m-0 text-sm">
                    {i18n.t('This person is inactive.')}
                </p>
            )}
        </header>
    )
}
