import {
    Field,
    FieldDescription,
    FieldLabel,
} from '@/components/dhis2/ui/field'
import { Input } from '@/components/dhis2/ui/input'

/** One text field: its label, the input, and a line on what the value is for. */
const FieldInput = () => (
    <Field className="max-w-sm">
        <FieldLabel htmlFor="phone-number">Phone number</FieldLabel>
        <Input id="phone-number" type="tel" placeholder="+232 76 123 456" />
        <FieldDescription>
            Used to send visit reminders by SMS.
        </FieldDescription>
    </Field>
)

export default FieldInput
