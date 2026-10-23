import { useState } from 'react'
import type { FinderPerson } from '@/components/tracked-entity-finder'
import { FindPerson } from '@/components/tracked-entity-finder-01'

/**
 * Find a person by ID, with a "No ID?" fallback.
 *
 * `FindPerson` is the `tracked-entity-finder-01` block: install it and edit
 * its source. It searches the WHO RMNCH Tracker in the DHIS2 Sierra Leone
 * demo database; its uids are named constants at the top of the file.
 */
export default function FindPersonExample() {
    const [person, setPerson] = useState<FinderPerson>()

    return (
        <div className="flex flex-col gap-6">
            <FindPerson onSelect={setPerson} />

            {/* Replace with what your app does next, such as opening the
                person's record. */}
            <p className="text-sm text-dhis2-grey-700" aria-live="polite">
                {person
                    ? `Selected ${person.trackedEntity}`
                    : 'Search, then select a person.'}
            </p>
        </div>
    )
}
