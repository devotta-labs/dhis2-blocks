import i18n from '@dhis2/d2-i18n'
import React, { useState } from 'react'
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
 * Replace with your program's uids. List them with:
 * GET /api/programs/<program>?fields=name,minAttributesRequiredToSearch,programTrackedEntityAttributes[searchable,displayInList,trackedEntityAttribute[id,displayName,valueType,unique]]
 *
 * These point at the WHO RMNCH Tracker in the Sierra Leone demo database.
 */
const PROGRAM = 'WSGAb5XwJ3Y'
/** A unique, searchable attribute: the person's ID. */
const ID_ATTRIBUTE = 'lZGmxYbs97q'
/** Searchable attributes for people without their ID to hand. */
const FIRST_NAME = 'w75KJ2mc4zz'
const DATE_OF_BIRTH = 'gHGyrwKPzej'

export interface FindPersonProps {
    /** Called with the person the user picks from the results. */
    onSelect: (person: FinderPerson) => void
}

/** The first form: one exact ID. Edit the fields here to search by another ID. */
function SearchById({ onNoId }: { onNoId: () => void }) {
    return (
        <FinderForm>
            <FinderField attribute={ID_ATTRIBUTE} />
            <FinderHint />
            <div className="flex flex-col items-start gap-1">
                <FinderSubmit />
                <Button type="button" variant="link" onClick={onNoId}>
                    {i18n.t('No ID?')}
                </Button>
            </div>
        </FinderForm>
    )
}

/** The fallback form. Add, remove or reorder fields here. */
function SearchByDetails({ onSearchById }: { onSearchById: () => void }) {
    return (
        <FinderForm>
            <FinderField attribute={FIRST_NAME} />
            <FinderField attribute={DATE_OF_BIRTH} />
            <FinderHint />
            <div className="flex flex-col items-start gap-1">
                <FinderSubmit />
                <Button type="button" variant="link" onClick={onSearchById}>
                    {i18n.t('Search by ID instead')}
                </Button>
            </div>
        </FinderForm>
    )
}

/**
 * Find a person by ID, with a "No ID?" fallback to first name and date of
 * birth. One way to compose the tracked entity finder's parts: copy it and
 * change the forms, the fields or the results to suit your app.
 */
export function FindPerson({ onSelect }: FindPersonProps) {
    // Two explicit forms, one shown at a time. Swapping keeps the results
    // until the next Search.
    const [hasId, setHasId] = useState(true)

    return (
        <FinderProvider program={PROGRAM} onSelect={onSelect}>
            <div className="flex max-w-md flex-col gap-6">
                {hasId ? (
                    <SearchById onNoId={() => setHasId(false)} />
                ) : (
                    <SearchByDetails onSearchById={() => setHasId(true)} />
                )}

                {/* The default results. Compose FinderList, FinderItem and
                    FinderValue inside it to choose what each row shows. */}
                <FinderResults />
            </div>
        </FinderProvider>
    )
}
