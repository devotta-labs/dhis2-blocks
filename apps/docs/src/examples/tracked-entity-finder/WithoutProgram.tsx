import { useState } from 'react'
import {
    FinderField,
    FinderForm,
    FinderHint,
    FinderProvider,
    FinderResults,
    FinderSubmit,
    type FinderPerson,
} from '@/components/tracked-entity-finder'

/*
 * The Person tracked entity type in the Sierra Leone demo database. Replace
 * with your type's uids. List its searchable attributes with:
 * GET /api/trackedEntityTypes/<type>?fields=name,minAttributesRequiredToSearch,trackedEntityTypeAttributes[searchable,displayInList,trackedEntityAttribute[id,displayName,valueType,unique]]
 */
const PERSON = 'nEenWmSyUEp'
const FIRST_NAME = 'w75KJ2mc4zz'
const LAST_NAME = 'zDhUuAYrxNC'

/**
 * Find a person in every program at once: the finder searches the tracked
 * entity type with its own searchable attributes and search settings.
 */
export default function WithoutProgram() {
    const [person, setPerson] = useState<FinderPerson>()

    return (
        <FinderProvider trackedEntityType={PERSON} onSelect={setPerson}>
            <div className="flex max-w-md flex-col gap-6">
                <FinderForm>
                    <FinderField attribute={FIRST_NAME} />
                    <FinderField attribute={LAST_NAME} />
                    <FinderHint />
                    <FinderSubmit />
                </FinderForm>

                <FinderResults />

                <p
                    className="text-sm text-dhis2-muted-foreground"
                    aria-live="polite"
                >
                    {person
                        ? `Selected ${person.trackedEntity}`
                        : 'Search, then select a person.'}
                </p>
            </div>
        </FinderProvider>
    )
}
