import { useState } from 'react'
import {
    Field,
    FieldError,
    FieldGroup,
    FieldItem,
    FieldLabel,
    FieldLegend,
    FieldSet,
} from '@/components/dhis2/ui/field'
import { Input } from '@/components/dhis2/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/dhis2/ui/radio-group'

const results = ['Positive', 'Negative', 'Invalid']

/** Each field marked invalid with a message on how to fix it, until it is fixed. */
const FieldValidation = () => {
    const [weight, setWeight] = useState('450')
    const [result, setResult] = useState('')
    const weightInvalid = !(Number(weight) >= 0.5 && Number(weight) <= 300)

    return (
        <FieldGroup className="max-w-sm">
            <Field invalid={weightInvalid}>
                <FieldLabel htmlFor="weight">Weight in kg</FieldLabel>
                <Input
                    id="weight"
                    type="number"
                    value={weight}
                    onChange={(event) => setWeight(event.target.value)}
                />
                {weightInvalid && (
                    <FieldError>Enter a weight from 0.5 to 300 kg.</FieldError>
                )}
            </Field>
            <Field invalid={result === ''}>
                <FieldSet
                    render={
                        <RadioGroup
                            value={result}
                            onValueChange={(value: string) => setResult(value)}
                        />
                    }
                >
                    <FieldLegend variant="label">
                        Malaria test result
                    </FieldLegend>
                    {results.map((option) => (
                        <FieldItem key={option}>
                            <RadioGroupItem value={option} />
                            <FieldLabel>{option}</FieldLabel>
                        </FieldItem>
                    ))}
                </FieldSet>
                {result === '' && (
                    <FieldError>Choose the test result.</FieldError>
                )}
            </Field>
        </FieldGroup>
    )
}

export default FieldValidation
