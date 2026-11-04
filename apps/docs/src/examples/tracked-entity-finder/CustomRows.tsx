import { useState } from 'react'
import {
    FinderEmpty,
    FinderError,
    FinderField,
    FinderForm,
    FinderHint,
    FinderItem,
    FinderList,
    FinderPagination,
    FinderProvider,
    FinderResults,
    FinderSearching,
    FinderSubmit,
    FinderTooMany,
    FinderValue,
    type FinderPerson,
} from '@/components/tracked-entity-finder'

/*
 * WHO RMNCH Tracker in the Sierra Leone demo database. Replace with your
 * program's uids.
 */
const PROGRAM = 'WSGAb5XwJ3Y'
const FIRST_NAME = 'w75KJ2mc4zz'
const LAST_NAME = 'zDhUuAYrxNC'
const BIRTH_DATE = 'gHGyrwKPzej'

/**
 * Composed results: your own empty text and your own row content. Only the
 * parts you place render.
 */
export default function CustomRows() {
    const [person, setPerson] = useState<FinderPerson>()

    return (
        <FinderProvider program={PROGRAM} onSelect={setPerson}>
            <div className="flex max-w-md flex-col gap-6">
                <FinderForm>
                    <FinderField attribute={FIRST_NAME} />
                    <FinderHint />
                    <FinderSubmit />
                </FinderForm>

                <FinderResults className="flex flex-col gap-3">
                    <FinderSearching />
                    <FinderEmpty>
                        No one with that name. Check the spelling, or search by
                        ID.
                    </FinderEmpty>
                    <FinderTooMany />
                    <FinderError />
                    <FinderList className="flex flex-col gap-2">
                        <FinderItem>
                            <span className="font-medium">
                                <FinderValue attribute={FIRST_NAME} />{' '}
                                <FinderValue attribute={LAST_NAME} />
                            </span>
                            <span className="block text-dhis2-grey-700">
                                Born <FinderValue attribute={BIRTH_DATE} />
                            </span>
                        </FinderItem>
                    </FinderList>
                    <FinderPagination />
                </FinderResults>

                <p className="text-sm text-dhis2-grey-700" aria-live="polite">
                    {person
                        ? `Selected ${person.trackedEntity}`
                        : 'Search, then select a person.'}
                </p>
            </div>
        </FinderProvider>
    )
}
