import {
    Field,
    FieldDescription,
    FieldItem,
    FieldLabel,
    FieldLegend,
    FieldSet,
} from '@/components/dhis2/ui/field'
import { RadioGroup, RadioGroupItem } from '@/components/dhis2/ui/radio-group'

const results = ['Positive', 'Negative', 'Invalid']

/** One answer from a short list, named by its legend. */
const FieldRadioGroup = () => (
    <Field>
        <FieldSet render={<RadioGroup />}>
            <FieldLegend variant="label">Malaria test result</FieldLegend>
            {results.map((result) => (
                <FieldItem key={result}>
                    <RadioGroupItem value={result} />
                    <FieldLabel>{result}</FieldLabel>
                </FieldItem>
            ))}
        </FieldSet>
        <FieldDescription>From the rapid diagnostic test.</FieldDescription>
    </Field>
)

export default FieldRadioGroup
