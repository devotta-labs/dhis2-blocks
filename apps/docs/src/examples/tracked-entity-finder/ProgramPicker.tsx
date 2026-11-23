import { useId, useState } from 'react'
import { Field, FieldLabel } from '@/components/dhis2/ui/field'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/dhis2/ui/select'
import {
    FinderField,
    FinderForm,
    FinderHint,
    FinderProvider,
    FinderResults,
    FinderSubmit,
    type FinderPerson,
} from '@/components/tracked-entity-finder'

const PROGRAMS = [
    {
        value: 'WSGAb5XwJ3Y',
        label: 'WHO RMNCH Tracker',
        id: 'lZGmxYbs97q',
        details: ['w75KJ2mc4zz', 'gHGyrwKPzej'],
    },
    {
        value: 'ur1Edk5Oe2n',
        label: 'TB program',
        id: 'xs8A6tQJY0s',
        details: ['w75KJ2mc4zz', 'zDhUuAYrxNC'],
    },
] as const

type ProgramUid = (typeof PROGRAMS)[number]['value']

/**
 * The program comes from a select above the finder. Changing `program`
 * clears the values and the results, so nothing from one program shows
 * under the other.
 *
 * Two programs in the Sierra Leone demo database, each with its own fields:
 * the program's ID, and the details to search with when there is no ID.
 * Replace with your programs' uids.
 */
export default function ProgramPicker() {
    const selectId = useId()
    const [programUid, setProgramUid] = useState<ProgramUid>(PROGRAMS[0].value)
    const [person, setPerson] = useState<FinderPerson>()
    const program =
        PROGRAMS.find(({ value }) => value === programUid) ?? PROGRAMS[0]

    return (
        <div className="flex max-w-md flex-col gap-6">
            <Field className="gap-1">
                <FieldLabel htmlFor={selectId}>Program</FieldLabel>
                <Select
                    items={PROGRAMS}
                    value={programUid}
                    onValueChange={(next) => {
                        if (next) {
                            setProgramUid(next)
                            setPerson(undefined)
                        }
                    }}
                >
                    <SelectTrigger id={selectId}>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {PROGRAMS.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                                {item.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </Field>

            <FinderProvider program={program.value} onSelect={setPerson}>
                <FinderForm aria-label="Search by ID">
                    <FinderField attribute={program.id} />
                    <FinderHint />
                    <FinderSubmit />
                </FinderForm>

                <FinderForm aria-label="Search by details" className="mt-6">
                    {program.details.map((attribute) => (
                        <FinderField key={attribute} attribute={attribute} />
                    ))}
                    <FinderHint />
                    <FinderSubmit />
                </FinderForm>

                <FinderResults className="mt-6" />
            </FinderProvider>

            <p
                className="text-sm text-dhis2-muted-foreground"
                aria-live="polite"
            >
                {person
                    ? `Selected ${person.trackedEntity} in ${program.label}`
                    : 'Pick a program, search, then select a person.'}
            </p>
        </div>
    )
}
