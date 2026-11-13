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

const referrals = [
    {
        value: 'none',
        label: 'No referral',
        description: 'Treated here; follow up at the next visit.',
    },
    {
        value: 'health-centre',
        label: 'Health centre',
        description: 'For tests or care this clinic cannot give.',
    },
    {
        value: 'hospital',
        label: 'Hospital',
        description: 'For danger signs: send today, with a referral note.',
    },
]

/** Options that need a line of explanation: where to refer a patient. */
const RadioGroupDescription = () => (
    <Field className="w-fit">
        <FieldSet render={<RadioGroup />}>
            <FieldLegend variant="label">Referral</FieldLegend>
            {referrals.map((referral) => (
                <FieldItem key={referral.value}>
                    <RadioGroupItem value={referral.value} />
                    <FieldContent>
                        <FieldLabel>{referral.label}</FieldLabel>
                        <FieldDescription>
                            {referral.description}
                        </FieldDescription>
                    </FieldContent>
                </FieldItem>
            ))}
        </FieldSet>
    </Field>
)

export default RadioGroupDescription
