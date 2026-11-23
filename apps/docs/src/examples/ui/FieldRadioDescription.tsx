import {
    Field,
    FieldContent,
    FieldDescription,
    FieldItem,
    FieldLabel,
    FieldLegend,
    FieldSet,
} from '@/components/dhis2/ui/field'
import { RadioGroup, RadioGroupItem } from '@/components/dhis2/ui/radio-group'

const outcomes = [
    {
        value: 'CURED',
        label: 'Cured',
        description: 'Finished treatment with a negative test at the end.',
    },
    {
        value: 'COMPLETED',
        label: 'Treatment completed',
        description: 'Finished treatment, with no end test to show a cure.',
    },
    {
        value: 'LOST',
        label: 'Lost to follow-up',
        description: 'Stopped treatment for two months or more.',
    },
]

/** Options that each need a line of explanation. */
const FieldRadioDescription = () => (
    <Field className="max-w-md">
        <FieldSet render={<RadioGroup />}>
            <FieldLegend variant="label">TB treatment outcome</FieldLegend>
            {outcomes.map((outcome) => (
                <FieldItem key={outcome.value}>
                    <RadioGroupItem value={outcome.value} />
                    <FieldContent>
                        <FieldLabel>{outcome.label}</FieldLabel>
                        <FieldDescription>
                            {outcome.description}
                        </FieldDescription>
                    </FieldContent>
                </FieldItem>
            ))}
        </FieldSet>
    </Field>
)

export default FieldRadioDescription
