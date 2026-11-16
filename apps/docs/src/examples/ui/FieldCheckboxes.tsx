import { Checkbox } from '@/components/dhis2/ui/checkbox'
import {
    Field,
    FieldDescription,
    FieldItem,
    FieldLabel,
    FieldLegend,
    FieldSet,
} from '@/components/dhis2/ui/field'

const symptoms = ['Fever', 'Cough', 'Headache', 'Vomiting']

/** Several on-or-off options that answer one question. */
const FieldCheckboxes = () => (
    <Field>
        <FieldSet>
            <FieldLegend variant="label">Symptoms</FieldLegend>
            {symptoms.map((symptom) => (
                <FieldItem key={symptom}>
                    <Checkbox />
                    <FieldLabel>{symptom}</FieldLabel>
                </FieldItem>
            ))}
        </FieldSet>
        <FieldDescription>
            Tick every symptom the patient reports.
        </FieldDescription>
    </Field>
)

export default FieldCheckboxes
