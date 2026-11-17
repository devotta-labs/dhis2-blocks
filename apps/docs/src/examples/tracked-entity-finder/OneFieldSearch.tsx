import { useId, useState } from 'react'
import { Button } from '@/components/dhis2/ui/button'
import { Input } from '@/components/dhis2/ui/input'
import { Label } from '@/components/dhis2/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/dhis2/ui/radio-group'
import {
    FinderProvider,
    useFinderTextSearch,
    type FinderPerson,
} from '@/components/tracked-entity-finder'

/*
 * WHO RMNCH Tracker in the Sierra Leone demo database, searched within one
 * clinic (Ngelehun CHC). Replace these four uids with your program, the
 * clinic your user has selected, and two searchable text attributes.
 */
const PROGRAM = 'WSGAb5XwJ3Y'
const CLINIC = 'DiszpKrYNg8'
const FIRST_NAME = 'w75KJ2mc4zz'
const LAST_NAME = 'zDhUuAYrxNC'

type Match = 'all' | 'any'

const fullName = (person: FinderPerson) =>
    [person.attributes[FIRST_NAME], person.attributes[LAST_NAME]]
        .filter(Boolean)
        .join(' ') || person.trackedEntity

function NameSearch() {
    const id = useId()
    const [input, setInput] = useState('')
    const [match, setMatch] = useState<Match>('all')
    const term = input.trim()
    const [first, ...rest] = term.split(/\s+/)
    const last = rest.join(' ')
    // AND: the first word is the first name and the rest is the last name,
    // sent together as one search. OR: the whole input is looked up in each
    // attribute, one search per attribute.
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
                className="flex flex-col items-start gap-4"
                onSubmit={(event) => {
                    event.preventDefault()
                    if (longEnough) search.submit()
                }}
            >
                <div className="flex flex-col gap-2">
                    <p id={`${id}-match`} className="m-0 text-sm font-medium">
                        Find people whose
                    </p>
                    <RadioGroup<Match>
                        aria-labelledby={`${id}-match`}
                        value={match}
                        onValueChange={(value) => setMatch(value)}
                    >
                        <Label>
                            <RadioGroupItem value="all" />
                            First and last name both match (AND)
                        </Label>
                        <Label>
                            <RadioGroupItem value="any" />
                            First or last name matches (OR)
                        </Label>
                    </RadioGroup>
                </div>
                <div className="flex w-full flex-col gap-2">
                    <Label htmlFor={`${id}-name`} className="font-medium">
                        Name
                    </Label>
                    <Input
                        id={`${id}-name`}
                        aria-describedby={`${id}-hint`}
                        value={input}
                        onChange={(event) => setInput(event.target.value)}
                    />
                    <p
                        id={`${id}-hint`}
                        className="m-0 text-sm text-dhis2-muted-foreground"
                    >
                        {match === 'all'
                            ? 'First name, then last name, at least three characters each. For example, Linda Bailey.'
                            : 'One name of at least three characters. For example, Bailey.'}
                    </p>
                </div>
                <Button
                    disabled={!longEnough || !search.canSearch}
                    type="submit"
                >
                    Search
                </Button>
            </form>
            <div aria-live="polite" className="text-sm">
                {search.status === 'loading' && <p>Loading search setup…</p>}
                {search.status === 'searching' && <p>Searching…</p>}
                {search.status === 'empty' && <p>No one found.</p>}
                {search.status === 'too-many' && (
                    <p>Too many matches. Enter more of the name.</p>
                )}
                {search.status === 'error' && (
                    <p>Could not complete the search. Try again.</p>
                )}
                {search.status === 'results' && (
                    <ul aria-label="Search results" className="m-0 p-0">
                        {search.people.map((person) => (
                            <li
                                key={person.trackedEntity}
                                className="list-none"
                            >
                                <Button
                                    type="button"
                                    variant="link"
                                    className="px-0"
                                    onClick={() => search.select(person)}
                                >
                                    {fullName(person)}
                                </Button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    )
}

/**
 * One name input searched across first and last name: together in one
 * search (AND), or one search per attribute (OR). OR multiplies the load on
 * the server; read the warning in the docs before you use it.
 */
export default function OneFieldSearch() {
    const [person, setPerson] = useState<FinderPerson>()
    return (
        <FinderProvider program={PROGRAM} orgUnit={CLINIC} onSelect={setPerson}>
            <NameSearch />
            {/* Replace with what your app does next, such as opening the
                person's record. */}
            {person && (
                <p role="status" className="mt-4 text-sm">
                    Selected {fullName(person)}
                </p>
            )}
        </FinderProvider>
    )
}
