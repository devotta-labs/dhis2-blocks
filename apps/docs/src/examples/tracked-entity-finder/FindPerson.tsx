import { useState } from 'react'
import { Button } from '@/components/dhis2/ui/button'
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
 * WHO RMNCH Tracker in the Sierra Leone demo database. Replace with your
 * program's uids. List them with:
 * GET /api/programs/<program>?fields=name,minAttributesRequiredToSearch,programTrackedEntityAttributes[searchable,displayInList,trackedEntityAttribute[id,displayName,valueType,unique]]
 */
const PROGRAM = 'WSGAb5XwJ3Y'
/** A unique, searchable attribute: the person's ID. */
const ID_ATTRIBUTE = 'lZGmxYbs97q'
/** Searchable attributes for people without their ID to hand. */
const FIRST_NAME = 'w75KJ2mc4zz'
const DATE_OF_BIRTH = 'gHGyrwKPzej'

/** The first form: one exact ID. */
function SearchById({ onNoId }: { onNoId: () => void }) {
    return (
        <FinderForm>
            <FinderField attribute={ID_ATTRIBUTE} />
            <FinderHint />
            <div className="flex flex-col items-start gap-1">
                <FinderSubmit />
                <Button type="button" variant="link" onClick={onNoId}>
                    No ID?
                </Button>
            </div>
        </FinderForm>
    )
}

/** The fallback form: first name and date of birth. */
function SearchByDetails({ onSearchById }: { onSearchById: () => void }) {
    return (
        <FinderForm>
            <FinderField attribute={FIRST_NAME} />
            <FinderField attribute={DATE_OF_BIRTH} />
            <FinderHint />
            <div className="flex flex-col items-start gap-1">
                <FinderSubmit />
                <Button type="button" variant="link" onClick={onSearchById}>
                    Search by ID instead
                </Button>
            </div>
        </FinderForm>
    )
}

/**
 * Find a person by ID, with a "No ID?" fallback to first name and date of
 * birth. Two explicit forms, one shown at a time; swapping keeps the results
 * until the next Search.
 */
export default function FindPerson() {
    const [hasId, setHasId] = useState(true)
    const [person, setPerson] = useState<FinderPerson>()

    return (
        <FinderProvider program={PROGRAM} onSelect={setPerson}>
            <div className="flex max-w-md flex-col gap-6">
                {hasId ? (
                    <SearchById onNoId={() => setHasId(false)} />
                ) : (
                    <SearchByDetails onSearchById={() => setHasId(true)} />
                )}

                <FinderResults />

                {/* Replace with what your app does next, such as opening the
                    person's record. */}
                <p className="text-sm text-dhis2-grey-700" aria-live="polite">
                    {person
                        ? `Selected ${person.trackedEntity}`
                        : 'Search, then select a person.'}
                </p>
            </div>
        </FinderProvider>
    )
}
