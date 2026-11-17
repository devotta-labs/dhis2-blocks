import { useId, useState } from 'react'
import { Button } from '@/components/dhis2/ui/button'
import { Input } from '@/components/dhis2/ui/input'
import {
    FinderProvider,
    useFinderTextSearch,
    type FinderPerson,
} from '@/components/tracked-entity-finder'

// WHO RMNCH Tracker and the clinic that owns the demo record.
// Replace these four UIDs with your program, selected clinic and attributes.
const PROGRAM = 'WSGAb5XwJ3Y'
const CLINIC = 'DiszpKrYNg8'
const FIRST_NAME = 'w75KJ2mc4zz'
const LAST_NAME = 'zDhUuAYrxNC'

function NameSearch() {
    const id = useId()
    const [input, setInput] = useState('')
    const [match, setMatch] = useState<'all' | 'any'>('all')
    const term = input.trim()
    const [first, ...rest] = term.split(/\s+/)
    const last = rest.join(' ')
    const values =
        match === 'all'
            ? { [FIRST_NAME]: first, [LAST_NAME]: last }
            : { [FIRST_NAME]: term, [LAST_NAME]: term }
    const longEnough =
        match === 'all'
            ? first.length >= 3 && last.length >= 3
            : term.length >= 3
    const search = useFinderTextSearch(values, match)

    return (
        <div className="flex max-w-md flex-col gap-4">
            <form
                className="flex flex-col items-start gap-2"
                onSubmit={(event) => {
                    event.preventDefault()
                    if (longEnough) search.submit()
                }}
            >
                <label htmlFor={id}>Name</label>
                <Input
                    id={id}
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                />
                <label className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={match === 'any'}
                        onChange={(event) =>
                            setMatch(event.target.checked ? 'any' : 'all')
                        }
                    />
                    Match either name (OR)
                </label>
                <p className="text-sm text-dhis2-muted-foreground">
                    {match === 'all'
                        ? 'Enter a first and last name (at least three characters each).'
                        : 'Enter a name to look for in either attribute (at least three characters).'}
                </p>
                <Button
                    disabled={!longEnough || !search.canSearch}
                    type="submit"
                >
                    Search
                </Button>
            </form>
            <div aria-live="polite">
                {search.status === 'loading' && <p>Loading search setup…</p>}
                {search.status === 'searching' && <p>Searching…</p>}
                {search.status === 'empty' && <p>No one found.</p>}
                {search.status === 'too-many' && (
                    <p>Too many matches. Refine the name.</p>
                )}
                {search.status === 'error' && (
                    <p>Could not complete the search.</p>
                )}
                {search.status === 'results' && (
                    <ul aria-label="Last search results">
                        {search.people.map((person) => (
                            <li key={person.trackedEntity}>
                                <Button
                                    type="button"
                                    variant="link"
                                    onClick={() => search.select(person)}
                                >
                                    {[
                                        person.attributes[FIRST_NAME],
                                        person.attributes[LAST_NAME],
                                    ]
                                        .filter(Boolean)
                                        .join(' ') || person.trackedEntity}
                                </Button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    )
}

export default function OneFieldSearch() {
    const [person, setPerson] = useState<FinderPerson>()
    return (
        <FinderProvider program={PROGRAM} orgUnit={CLINIC} onSelect={setPerson}>
            <NameSearch />
            {person && <p role="status">Selected {person.trackedEntity}</p>}
        </FinderProvider>
    )
}
