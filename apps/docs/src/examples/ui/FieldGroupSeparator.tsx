import {
    Field,
    FieldDescription,
    FieldGroup,
    FieldLabel,
    FieldSeparator,
} from '@/components/dhis2/ui/field'
import { Input } from '@/components/dhis2/ui/input'

/** Two ways to find a person, split by a separator. */
const FieldGroupSeparator = () => (
    <FieldGroup className="max-w-sm">
        <Field>
            <FieldLabel htmlFor="person-name">Name</FieldLabel>
            <Input id="person-name" />
        </Field>
        <FieldSeparator>or</FieldSeparator>
        <Field>
            <FieldLabel htmlFor="unique-id">Unique ID</FieldLabel>
            <Input id="unique-id" />
            <FieldDescription>The ID on the patient’s card.</FieldDescription>
        </Field>
    </FieldGroup>
)

export default FieldGroupSeparator
