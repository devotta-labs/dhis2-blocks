import { Checkbox } from '@/components/dhis2/ui/checkbox'
import {
    Field,
    FieldContent,
    FieldDescription,
    FieldGroup,
    FieldLabel,
} from '@/components/dhis2/ui/field'
import { Switch } from '@/components/dhis2/ui/switch'

/** A checkbox and a switch, each beside its own label. */
const FieldHorizontal = () => (
    <FieldGroup className="max-w-md">
        <Field orientation="horizontal">
            <Checkbox id="consent" />
            <FieldLabel htmlFor="consent">
                Consent to share results with the referral facility
            </FieldLabel>
        </Field>
        <Field orientation="horizontal">
            <FieldContent>
                <FieldLabel htmlFor="sms-reminders">SMS reminders</FieldLabel>
                <FieldDescription>
                    Send a reminder the day before each visit.
                </FieldDescription>
            </FieldContent>
            <Switch id="sms-reminders" defaultChecked />
        </Field>
    </FieldGroup>
)

export default FieldHorizontal
