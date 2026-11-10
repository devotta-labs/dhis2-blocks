import {
    Field,
    FieldContent,
    FieldDescription,
    FieldLabel,
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
    <div className="flex flex-col gap-3">
        <p id="referral" className="m-0 text-sm font-medium">
            Referral
        </p>
        <RadioGroup aria-labelledby="referral" className="w-fit">
            {referrals.map((referral) => (
                <Field key={referral.value} orientation="horizontal">
                    <RadioGroupItem value={referral.value} />
                    <FieldContent>
                        <FieldLabel>{referral.label}</FieldLabel>
                        <FieldDescription>
                            {referral.description}
                        </FieldDescription>
                    </FieldContent>
                </Field>
            ))}
        </RadioGroup>
    </div>
)

export default RadioGroupDescription
