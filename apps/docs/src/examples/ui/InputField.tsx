import { useState } from 'react'
import {
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
} from '@/components/dhis2/ui/field'
import { Input } from '@/components/dhis2/ui/input'

/** Two text fields with labels, a hint, and an error once the age is too high. */
const InputField = () => {
    const [age, setAge] = useState('120')
    const invalid = Number(age) > 110

    return (
        <FieldGroup className="max-w-sm">
            <Field>
                <FieldLabel htmlFor="first-name">First name</FieldLabel>
                <Input id="first-name" placeholder="For example, Aminata" />
            </Field>
            <Field data-invalid={invalid}>
                <FieldLabel htmlFor="age">Age in years</FieldLabel>
                <Input
                    id="age"
                    type="number"
                    value={age}
                    aria-invalid={invalid}
                    onChange={(event) => setAge(event.target.value)}
                />
                <FieldDescription>
                    Use the age at the last birthday.
                </FieldDescription>
                {invalid && (
                    <FieldError>Enter an age of 110 or less.</FieldError>
                )}
            </Field>
        </FieldGroup>
    )
}

export default InputField
